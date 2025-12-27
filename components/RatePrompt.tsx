import React, { useEffect } from "react";
import {
  markRatePromptShown,
  requestReview,
} from "../utils/rateShareTracking";

interface RatePromptProps {
  visible: boolean;
  onClose: () => void;
}

export const RatePrompt: React.FC<RatePromptProps> = ({ visible, onClose }) => {
  useEffect(() => {
    if (visible) {
      // Mark prompt as shown
      markRatePromptShown();
      
      // Close our modal immediately
      onClose();
      
      // Open native rating modal after a brief delay
      setTimeout(async () => {
        await requestReview();
      }, 300);
    }
  }, [visible]);

  // This component doesn't render anything - it just triggers the native modal
  return null;
};

