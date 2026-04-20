const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Medicine name is required'],
      trim: true,
      maxlength: [120, 'Medicine name cannot exceed 120 characters'],
    },
    genericName: {
      type: String,
      trim: true,
      maxlength: [120, 'Generic name cannot exceed 120 characters'],
    },
    brand: {
      type: String,
      trim: true,
      maxlength: [120, 'Brand cannot exceed 120 characters'],
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    dosageForm: {
      type: String,
      trim: true,
      default: 'tablet',
    },
    strength: {
      type: String,
      trim: true,
    },
    unitPrice: {
      type: Number,
      min: [0, 'Unit price cannot be negative'],
      default: 0,
    },
    mrp: {
      type: Number,
      min: [0, 'MRP cannot be negative'],
      default: 0,
    },
    stock: {
      type: Number,
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      min: [0, 'Low stock threshold cannot be negative'],
      default: 10,
    },
    available: {
      type: Boolean,
      default: true,
    },
    requiresPrescription: {
      type: Boolean,
      default: true,
    },
    manufacturer: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

medicineSchema.virtual('stockStatus').get(function () {
  if (!this.available || this.stock <= 0) return 'out_of_stock';
  if (this.stock <= this.lowStockThreshold) return 'low_stock';
  return 'available';
});

medicineSchema.index({ name: 1 }, { unique: true });
medicineSchema.index({ category: 1, available: 1, isActive: 1 });
medicineSchema.index({ stock: 1 });

module.exports = mongoose.model('Medicine', medicineSchema);
