import Joi from 'joi';

// Login validation schema
const loginSchema = Joi.object({
  username: Joi.string().required().min(3).max(50),
  password: Joi.string().required().min(6)
});

// Register validation schema
const registerSchema = Joi.object({
  username: Joi.string().required().min(3).max(50),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(6),
  role: Joi.string().valid('admin', 'manager', 'viewer').default('viewer')
});

// Certificate upload validation schema
const certificateUploadSchema = Joi.object({
  folderId: Joi.string().optional().allow(null),
  certificate: Joi.any().optional()
});

// Folder creation validation schema
const folderSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  description: Joi.string().optional().max(500),
  permissions: Joi.array().items(Joi.string().valid('read', 'write', 'delete')).default(['read']),
  accessControl: Joi.object({
    roles: Joi.array().items(Joi.string()),
    users: Joi.array().items(Joi.string())
  }).optional()
});

export const validateLogin = (req, res, next) => {
  const { error } = loginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      error: 'Validation error', 
      details: error.details.map(d => d.message) 
    });
  }
  next();
};

export const validateRegister = (req, res, next) => {
  const { error } = registerSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      error: 'Validation error', 
      details: error.details.map(d => d.message) 
    });
  }
  next();
};

export const validateCertificateUpload = (req, res, next) => {
  const { error } = certificateUploadSchema.validate(req.body, { allowUnknown: true });
  if (error) {
    return res.status(400).json({ 
      error: 'Validation error', 
      details: error.details.map(d => d.message) 
    });
  }
  next();
};

export const validateFolder = (req, res, next) => {
  const { error } = folderSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      error: 'Validation error', 
      details: error.details.map(d => d.message) 
    });
  }
  next();
};

export const validateId = (req, res, next) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Valid ID is required' });
  }
  next();
}; 