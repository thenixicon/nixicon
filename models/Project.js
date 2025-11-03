const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Project description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedDeveloper: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['draft', 'prototype', 'in-development', 'testing', 'deployed', 'cancelled'],
    default: 'draft'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['mobile-app', 'web-app', 'website', 'automation', 'ai-tool', 'other'],
    required: true
  },
  platform: {
    type: [String],
    enum: ['ios', 'android', 'web', 'desktop'],
    default: ['web']
  },
  features: [{
    name: String,
    description: String,
    complexity: {
      type: String,
      enum: ['simple', 'medium', 'complex'],
      default: 'medium'
    },
    estimatedHours: Number,
    completed: { type: Boolean, default: false }
  }],
  design: {
    mockups: [String], // URLs to uploaded mockup images
    wireframes: [String], // URLs to wireframe images
    styleGuide: {
      colors: [String],
      fonts: [String],
      logo: String
    }
  },
  technical: {
    frontend: {
      framework: String,
      libraries: [String]
    },
    backend: {
      language: String,
      framework: String,
      database: String
    },
    hosting: {
      provider: String,
      domain: String,
      ssl: { type: Boolean, default: true }
    }
  },
  timeline: {
    estimatedStart: Date,
    estimatedEnd: Date,
    actualStart: Date,
    actualEnd: Date,
    milestones: [{
      name: String,
      description: String,
      dueDate: Date,
      completed: { type: Boolean, default: false },
      completedAt: Date
    }]
  },
  budget: {
    estimated: Number,
    actual: Number,
    currency: { type: String, default: 'USD' },
    breakdown: [{
      item: String,
      cost: Number,
      category: String
    }]
  },
  files: [{
    name: String,
    url: String,
    type: String,
    size: Number,
    uploadedAt: { type: Date, default: Date.now }
  }],
  communication: [{
    type: {
      type: String,
      enum: ['message', 'file', 'milestone', 'status-update'],
      required: true
    },
    content: String,
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    attachments: [String],
    timestamp: { type: Date, default: Date.now },
    readBy: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      readAt: { type: Date, default: Date.now }
    }]
  }],
  deployment: {
    status: {
      type: String,
      enum: ['not-started', 'in-progress', 'completed', 'failed'],
      default: 'not-started'
    },
    environments: [{
      name: String,
      url: String,
      status: String,
      deployedAt: Date
    }],
    appStore: {
      ios: {
        status: String,
        appId: String,
        url: String
      },
      android: {
        status: String,
        packageName: String,
        url: String
      }
    }
  },
  aiGenerated: {
    isAiGenerated: { type: Boolean, default: false },
    prompt: String,
    generatedAt: Date,
    confidence: Number
  }
}, {
  timestamps: true
});

// Indexes for better performance
projectSchema.index({ owner: 1, status: 1 });
projectSchema.index({ assignedDeveloper: 1, status: 1 });
projectSchema.index({ category: 1, status: 1 });
projectSchema.index({ createdAt: -1 });

// Virtual for project age
projectSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Method to get project progress
projectSchema.methods.getProgress = function() {
  if (!this.features || this.features.length === 0) return 0;
  const completed = this.features.filter(f => f.completed).length;
  return Math.round((completed / this.features.length) * 100);
};

// Method to add communication
projectSchema.methods.addCommunication = function(type, content, authorId, attachments = []) {
  this.communication.push({
    type,
    content,
    author: authorId,
    attachments,
    timestamp: new Date()
  });
  return this.save();
};

module.exports = mongoose.model('Project', projectSchema);
