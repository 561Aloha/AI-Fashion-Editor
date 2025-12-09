import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const HF_API_KEY = process.env.HF_API_KEY;

if (!HF_API_KEY) {
  console.error('ERROR: HF_API_KEY not found in environment variables');
  process.exit(1);
}

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Background removal endpoint
app.post('/api/remove-background', async (req: Request, res: Response) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    console.log('[Server] Processing background removal...');

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const response = await fetch(
      'https://api-inference.huggingface.co/models/briaai/RMBG-1.4',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/octet-stream',
        },
        body: imageBuffer,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Server] HF API error:', errorText);
      return res.status(response.status).json({ 
        error: 'Background removal failed', 
        details: errorText 
      });
    }

    const resultBuffer = await response.arrayBuffer();
    const resultBase64 = Buffer.from(resultBuffer).toString('base64');

    console.log('[Server] Background removal successful');
    res.json({ imageBase64: resultBase64 });

  } catch (error: any) {
    console.error('[Server] Error in background removal:', error.message);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// Virtual try-on endpoint
app.post('/api/virtual-tryon', async (req: Request, res: Response) => {
  try {
    const { personImage, garmentImage, parameters } = req.body;

    if (!personImage || !garmentImage) {
      return res.status(400).json({ error: 'Missing required images' });
    }

    console.log('[Server] Processing virtual try-on...');

    const payload = {
      inputs: {
        person_image: personImage.includes('base64,') 
          ? personImage 
          : `data:image/png;base64,${personImage}`,
        garment_image: garmentImage.includes('base64,')
          ? garmentImage
          : `data:image/png;base64,${garmentImage}`,
      },
      parameters: parameters || {
        num_inference_steps: 30,
        guidance_scale: 2.0,
      }
    };

    const response = await fetch(
      'https://api-inference.huggingface.co/models/yisol/IDM-VTON',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Server] HF API error:', errorText);
      return res.status(response.status).json({ 
        error: 'Virtual try-on failed', 
        details: errorText 
      });
    }

    const resultBuffer = await response.arrayBuffer();
    const resultBase64 = Buffer.from(resultBuffer).toString('base64');

    console.log('[Server] Virtual try-on successful');
    res.json({ imageBase64: resultBase64 });

  } catch (error: any) {
    console.error('[Server] Error in virtual try-on:', error.message);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`✅ HF API Key configured: ${HF_API_KEY.substring(0, 7)}...`);
});