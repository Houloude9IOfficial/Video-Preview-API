import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import previewRoutes from './routes/preview.js';
import fetchRoutes from './routes/fetch.js';
import { PORT } from './utils/constants.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api', previewRoutes);
app.use('/api/fetch', fetchRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
