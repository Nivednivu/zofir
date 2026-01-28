const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors()); 
app.use(express.json());

app.use("/uploads", express.static("uploads"));

const MONGODB_URI = "mongodb+srv://nivedtp6_db_user:WHqDDdPo96Cq5hHA@cluster0.wydedx7.mongodb.net/taskmanager?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI)
.then(() => console.log("✅ MongoDB connected successfully"))
.catch(err => {
    console.error("❌ MongoDB connection error:", err.message);
    
    mongoose.connect("mongodb://127.0.0.1:27017/taskmanager")
    .then(() => console.log("✅ Connected to local MongoDB"))
    .catch(localErr => console.error("❌ Local MongoDB also failed:", localErr.message));
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
            console.log(`📁 Created upload directory: ${uploadDir}`);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        cb(null, 'profile-' + uniqueSuffix + path.extname(safeName));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const allowedExtensions = /jpeg|jpg|png|gif|webp/;
    
    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.includes(file.mimetype);
    
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (JPEG, JPG, PNG, GIF, WebP)'));
    }
};
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, 
    fileFilter: fileFilter
});
const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [6, "Password must be at least 6 characters"]
    },
    profileImage: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});
const User = mongoose.model("User", UserSchema);
app.get("/", (req, res) => {
    res.json({ 
        message: "Task Manager API is running", 
        status: "OK",
        endpoints: {
            register: "POST /register",
            login: "POST /login",
            users: "GET /users",
            uploads: "GET /uploads/:filename"
        }
    });
});
app.get("/db-status", async (req, res) => {
    try {
        const isConnected = mongoose.connection.readyState === 1;
        const userCount = await User.countDocuments();
        
        res.json({
            dbConnected: isConnected,
            connectionState: mongoose.connection.readyState,
            userCount: userCount,
            message: isConnected ? "Database connected" : "Database not connected"
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post("/register", upload.single('profileImage'), async (req, res) => {
    try {
        console.log("Registration request received");
        console.log("Body:", req.body);
        console.log("File:", req.file);
        
        const { email, password } = req.body;
        
        if (!email || !email.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: "Email is required" 
            });
        }
        
        if (!password) {
            return res.status(400).json({ 
                success: false, 
                message: "Password is required" 
            });
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false, 
                message: "Please enter a valid email address" 
            });
        }
        
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: "Email already registered" 
            });
        }
        
        let profileImagePath = null;
        if (req.file) {
            profileImagePath = req.file.filename;
        }
        
        const newUser = new User({
            email: email.toLowerCase(),
            password: password, 
            profileImage: profileImagePath
        });
        
        await newUser.save();
        console.log("✅ User registered:", newUser.email);
        
        res.status(201).json({ 
            success: true, 
            message: "Registration successful!",
            user: {
                id: newUser._id,
                email: newUser.email,
                profileImage: profileImagePath ? `/uploads/${profileImagePath}` : null,
                createdAt: newUser.createdAt
            }
        });
        
    } catch (error) {
        console.error("❌ Registration error:", error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: Object.values(error.errors).map(err => err.message)
            });
        }
        
        if (error.code === 11000) { 
            return res.status(400).json({
                success: false,
                message: "Email already exists"
            });
        }
        
        res.status(500).json({ 
            success: false,  
            message: "Server error during registration", 
            error: error.message 
        });
    }
});
app.post("/login", async (req, res) => {
    try {
        console.log("Login attempt:", req.body.email);
        
        const { email, password } = req.body;
        
        if (!email || !email.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: "Email is required" 
            });
        }
        
        if (!password) {
            return res.status(400).json({ 
                success: false, 
                message: "Password is required" 
            });
        }
        
        const user = await User.findOne({ 
            email: email.toLowerCase(), 
            password: password 
        });
        
        if (user) {
            console.log("✅ Login successful for:", user.email);
            res.json({ 
                success: true,
                message: "Login successful",
                user: {
                    id: user._id,
                    email: user.email,
                    profileImage: user.profileImage ? `/uploads/${user.profileImage}` : null,
                    createdAt: user.createdAt
                }
            });
        } else {
            console.log("❌ Login failed for:", email);
            res.status(401).json({ 
                success: false, 
                message: "Invalid email or password" 
            });
        }
    } catch (error) {
        console.error("❌ Login error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error during login",
            error: error.message 
        });
    }
});
app.get("/users", async (req, res) => {
    try {
        const users = await User.find({}, { password: 0, __v: 0 }); 
        res.json({
            success: true,
            count: users.length,
            users: users
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching users",
            error: error.message
        });
    }
});
app.get("/test-upload", (req, res) => {
    res.send(`
        <h2>Test File Upload</h2>
        <form action="/register" method="post" enctype="multipart/form-data">
            <input type="email" name="email" placeholder="Email" required><br><br>
            <input type="password" name="password" placeholder="Password" required><br><br>
            <input type="file" name="profileImage" accept="image/*"><br><br>
            <button type="submit">Register</button>
        </form>
    `); 
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`\n🚀 Server started successfully!`);
}); 