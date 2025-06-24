export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message
    });
  }

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        details: 'File size exceeds the maximum allowed limit'
      });
    }
    return res.status(400).json({
      error: 'File upload error',
      details: err.message
    });
  }

  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(400).json({
      error: 'Database constraint error',
      details: 'The operation violates a database constraint'
    });
  }

  // Handle GCP errors
  if (err.code && err.code.startsWith('GOOGLE_')) {
    return res.status(500).json({
      error: 'GCP Service Error',
      details: err.message
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}; 