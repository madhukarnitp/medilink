const mongoose = require("mongoose");
const Consultation = require("../models/Consultation");
const Doctor = require("../models/Doctor");

const roundRating = (value) =>
  Number.isFinite(Number(value)) ? Math.round(Number(value) * 10) / 10 : 0;

const getDoctorId = (doctor) => String(doctor?._id || "");

async function getDoctorReviewSummaryMap(doctorIds = []) {
  const normalizedIds = [...new Set(doctorIds.map(String).filter(Boolean))];
  if (normalizedIds.length === 0) return new Map();

  const summaries = await Consultation.aggregate([
    {
      $match: {
        doctor: { $in: normalizedIds.map((id) => new mongoose.Types.ObjectId(id)) },
        "review.rating": { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: "$doctor",
        rating: { $avg: "$review.rating" },
        ratingCount: { $sum: 1 },
      },
    },
  ]);

  return new Map(
    summaries.map((item) => [
      String(item._id),
      {
        rating: roundRating(item.rating),
        ratingCount: Number(item.ratingCount) || 0,
      },
    ]),
  );
}

function attachDoctorReviewSummary(doctor, summaryMap) {
  if (!doctor) return doctor;

  const summary = summaryMap.get(getDoctorId(doctor)) || {
    rating: 0,
    ratingCount: 0,
  };

  return {
    ...doctor,
    rating: summary.rating,
    ratingCount: summary.ratingCount,
  };
}

async function attachDoctorReviewSummaries(doctors = []) {
  const summaryMap = await getDoctorReviewSummaryMap(
    doctors.map((doctor) => doctor?._id),
  );

  return doctors.map((doctor) => attachDoctorReviewSummary(doctor, summaryMap));
}

async function getRecentDoctorReviews(doctorId, limit = 5) {
  if (!doctorId) return [];

  const consultations = await Consultation.find({
    doctor: doctorId,
    "review.rating": { $exists: true, $ne: null },
  })
    .sort({ "review.createdAt": -1, updatedAt: -1 })
    .limit(limit)
    .populate({
      path: "patient",
      populate: { path: "userId", select: "name avatar" },
    })
    .lean({ virtuals: true });

  return consultations.map((consultation) => ({
    id: consultation._id,
    rating: consultation.review?.rating || 0,
    comment: consultation.review?.comment || "",
    createdAt: consultation.review?.createdAt || consultation.updatedAt,
    patient: {
      name: consultation.patient?.userId?.name || consultation.patient?.name || "Patient",
      avatar: consultation.patient?.userId?.avatar || consultation.patient?.avatar || "",
    },
  }));
}

async function syncDoctorReviewSummary(doctorId) {
  const summaryMap = await getDoctorReviewSummaryMap([doctorId]);
  const summary = summaryMap.get(String(doctorId)) || { rating: 0, ratingCount: 0 };

  await Doctor.findByIdAndUpdate(doctorId, {
    $set: {
      rating: summary.rating,
      ratingCount: summary.ratingCount,
    },
  });

  return summary;
}

module.exports = {
  attachDoctorReviewSummary,
  attachDoctorReviewSummaries,
  getDoctorReviewSummaryMap,
  getRecentDoctorReviews,
  syncDoctorReviewSummary,
};
