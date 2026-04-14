import { useState } from "react";
import { Modal, Button } from "../../ui/UI";
import styles from "./CSS/RatingModal.module.css";

export default function RatingModal({
  doctorName,
  rating,
  comment,
  onRatingChange,
  onCommentChange,
  onSubmit,
  onSkip,
}) {
  const [hoveredRating, setHoveredRating] = useState(0);

  const handleSubmit = () => {
    onSubmit();
  };

  return (
    <Modal closeOnBackdrop={false} priority>
      <div className={styles.ratingModalContent}>
        <button className={styles.closeButton} onClick={onSkip} type="button">
          ×
        </button>
        <h2>Rate Your Consultation</h2>
        <p className={styles.doctorName}>How was your experience with {doctorName}?</p>

        <div className={styles.form}>
          <div className={styles.ratingSection}>
            <h3 className={styles.ratingLabel}>Rating</h3>
            <div className={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`${styles.star} ${
                    star <= (hoveredRating || rating) ? styles.active : ""
                  }`}
                  onClick={() => onRatingChange(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                >
                  ★
                </button>
              ))}
            </div>
            <div className={styles.ratingText}>
              {rating === 1 && "Poor"}
              {rating === 2 && "Fair"}
              {rating === 3 && "Good"}
              {rating === 4 && "Very Good"}
              {rating === 5 && "Excellent"}
            </div>
          </div>

          <div className={styles.commentSection}>
            <label className={styles.commentLabel}>
              Comment (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => onCommentChange(e.target.value)}
              placeholder="Share your feedback..."
              rows={3}
              maxLength={500}
            />
            <div className={styles.charCount}>
              {comment.length}/500
            </div>
          </div>

          <div className={styles.modalActions}>
            <Button variant="outline" onClick={onSkip}>
              Skip
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={rating === 0}
            >
              Submit Rating
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
