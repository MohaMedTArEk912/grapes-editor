import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import projectRoutes from './routes/project.routes';
import authRoutes from './routes/auth.routes';
import { protect } from './middleware/auth.middleware';

dotenv.config();

// Connect to Database
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(helmet());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', protect, projectRoutes); // Protected Routes

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
