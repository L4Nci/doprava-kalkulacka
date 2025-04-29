import express from 'express';
import cors from 'cors';
import auditRouter from './routes/audit.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Rozšířená CORS konfigurace
app.use(cors({
  origin: 'http://localhost:5173', // Vite výchozí port
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', auditRouter);

app.listen(PORT, () => {
  console.log(`Server běží na portu ${PORT}`);
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});
