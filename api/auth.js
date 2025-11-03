// This file is deprecated - individual auth endpoints are now in api/auth/ directory
// Keeping for backward compatibility but redirecting to individual functions
export default async function handler(req, res) {
  return res.status(410).json({
    success: false,
    message: 'This endpoint has been moved. Please use the individual auth endpoints in /api/auth/'
  });
}
