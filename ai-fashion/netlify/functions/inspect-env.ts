import type { Handler } from '@netlify/functions';

export const handler: Handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(
      {
        HF_API_KEY: process.env.HF_API_KEY || null,
        KEYS: Object.keys(process.env || {}), // just to see what’s there
      },
      null,
      2
    ),
  };
};
