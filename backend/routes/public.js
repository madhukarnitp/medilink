const express = require("express");
const { query } = require("express-validator");

const { getNearbyHospitals } = require("../controllers/publicController");
const validate = require("../middleware/validate");

const router = express.Router();

router.get(
  "/nearby-hospitals",
  [
    query("lat")
      .exists()
      .withMessage("Latitude is required")
      .bail()
      .isFloat({ min: -90, max: 90 })
      .withMessage("Latitude must be between -90 and 90"),
    query("lng")
      .exists()
      .withMessage("Longitude is required")
      .bail()
      .isFloat({ min: -180, max: 180 })
      .withMessage("Longitude must be between -180 and 180"),
  ],
  validate,
  getNearbyHospitals,
);

module.exports = router;
