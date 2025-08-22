import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { submitFeedback } from '@/services/feedback';
import { useAnalytics } from '@/hooks/useAnalytics';

interface AboutMeModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId?: string;
  deviceId?: string;
  teamName?: string;
  displayName?: string;
}

const AboutMeModal: React.FC<AboutMeModalProps> = ({ isOpen, onClose, teamId, deviceId, teamName, displayName }) => {
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [modalOpenTime, setModalOpenTime] = useState<number | null>(null);

  // Analytics tracking
  const { trackFeature, trackBusiness, trackEvent } = useAnalytics();

  // Track modal open
  useEffect(() => {
    if (isOpen && !modalOpenTime) {
      const openTime = Date.now();
      setModalOpenTime(openTime);
      
      trackFeature('about_me_modal', 'modal_opened', {
        team_id: teamId
      });
    } else if (!isOpen && modalOpenTime) {
      setModalOpenTime(null);
    }
  }, [isOpen, modalOpenTime, trackFeature, teamId, deviceId, teamName, displayName]);

  // Track modal close with duration
  useEffect(() => {
    if (!isOpen && modalOpenTime) {
      const duration = Date.now() - modalOpenTime;
      trackFeature('about_me_modal', 'modal_closed', {
        team_id: teamId,
        session_duration_ms: duration
      });
      setModalOpenTime(null);
    }
  }, [isOpen, modalOpenTime, showSuccess, trackFeature, teamId, deviceId, teamName, displayName]);

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) {
      // Track empty feedback attempt
      trackFeature('about_me_modal', 'feedback_empty_attempt', {
        team_id: teamId
      });

      // Elegant shake animation for empty input
      const input = document.getElementById('feedback-input');
      if (input) {
        input.style.animation = 'gentleShake 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        setTimeout(() => {
          input.style.animation = '';
        }, 600);
      }
      return;
    }

    setIsSubmitting(true);
    
    // Track feedback submission start
    trackFeature('about_me_modal', 'feedback_submission_started', {
      team_id: teamId
    });
    
    try {
      // Send feedback to the database via service
      const result = await submitFeedback({
        team_id: teamId,
        device_id: deviceId,
        team_name: teamName,
        display_name: displayName,
        feedback_text: feedback.trim()
      });

      console.log('Feedback submitted successfully:', result);
      setShowSuccess(true);
      toast.success('Feedback submitted successfully!');
      
      // Track successful feedback submission
      trackFeature('about_me_modal', 'feedback_submitted_success', {
        team_id: teamId
      });
      
      // Auto-close modal after 2.5 seconds with collapse animation
      setTimeout(() => {
        handleClose();
      }, 2500);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
      
      // Track feedback submission error
      trackFeature('about_me_modal', 'feedback_submission_error', {
        team_id: teamId,
        error_details: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVenmoClick = () => {
    // Track Venmo click
    trackFeature('about_me_modal', 'venmo_clicked', {
      team_id: teamId
    });

    const venmoUrl = 'https://venmo.com/code?user_id=1733638827802624595&created=1755816455';
    window.open(venmoUrl, '_blank');
    setShowSuccess(true);
    toast.success('Opening Venmo...');
    
    // Auto-close modal after 2.5 seconds with collapse animation
    setTimeout(() => {
      handleClose();
    }, 2500);
  };

  const handleClose = () => {
          // Track manual close
      if (modalOpenTime) {
        trackFeature('about_me_modal', 'modal_manually_closed', {
          team_id: teamId,
          session_duration_ms: Date.now() - modalOpenTime
        });
      }

    setIsCollapsing(true);
    
    // Wait for collapse animation to complete before actually closing
    setTimeout(() => {
      setFeedback('');
      setShowSuccess(false);
      setIsSubmitting(false);
      setIsCollapsing(false);
      onClose();
    }, 400); // Match the animation duration
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // Track Enter key press for feedback submission
      trackFeature('about_me_modal', 'feedback_enter_key_pressed', {
        team_id: teamId
      });
      
      handleSubmitFeedback();
    }
  };

  const handleFeedbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setFeedback(newValue);
    
    // Track feedback typing (debounced to avoid too many events)
    if (newValue.length > 0 && newValue.length % 10 === 0) {
      trackFeature('about_me_modal', 'feedback_typing_progress', {
        team_id: teamId
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`max-w-sm p-0 overflow-hidden bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl transition-all duration-400 ease-out ${
        isCollapsing ? 'animate-collapse' : 'animate-in fade-in-0 zoom-in-95'
      }`}>
        <div className="p-8 text-center">
          {/* Profile Photo */}
          <div className="w-20 h-20 mx-auto mb-5 rounded-full overflow-hidden bg-gradient-to-br from-pink-400 via-purple-400 to-pink-400 shadow-lg relative transition-transform duration-300 hover:scale-105">
            <img 
              src="/Headshot.jfif" 
              alt="Caleb Seely" 
              className="w-full h-full object-cover"
            />
          </div>
          
          {!showSuccess ? (
            <>
                             {/* Title and Message */}
               <h3 className="text-lg font-semibold text-gray-900 mb-2">Hi, I'm Caleb.</h3>
               <p className="text-sm text-gray-700 leading-relaxed mb-6">
                 I built this app instead of filling out job apps.<br /><br />
                 Building tools like this is what I love most—if you know anyone hiring, point them to{' '}
                 <a 
                   href="https://CalebSeely.com" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="text-blue-600 hover:text-blue-800 underline font-semibold transition-colors duration-200"
                   onClick={() => {
                     trackFeature('about_me_modal', 'website_clicked', {
                       team_id: teamId
                     });
                   }}
                 >
                   CalebSeely.com
                 </a>
                 .<br /><br />
                 The app isn't perfect, so let me know what worked (and what didn't):
               </p>
              
              {/* Feedback Input */}
              <div className="mb-5">
                <Input
                  id="feedback-input"
                  type="text"
                  placeholder="Tell me what worked and what didn't..."
                  value={feedback}
                  onChange={handleFeedbackChange}
                  onKeyPress={handleKeyPress}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm bg-white/80 focus:border-blue-500 focus:bg-white/95 focus:ring-4 focus:ring-blue-500/10 transition-all duration-300 ease-out"
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleSubmitFeedback}
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Sending...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      Feedback
                    </div>
                  )}
                </Button>
                
                <Button
                  onClick={handleVenmoClick}
                  className="flex-1 bg-[#3D95CE] hover:bg-[#2B7DB8] text-white font-semibold py-3 rounded-xl transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                >
                  Venmo
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Success Message */}
                <h3 className="text-lg font-semibold text-gray-900 mb-2 transition-all duration-500 ease-out animate-in fade-in-0 slide-in-from-bottom-2">Thank you!</h3>
              <p className="text-sm text-gray-700 leading-relaxed mb-6 transition-all duration-500 ease-out animate-in fade-in-0 slide-in-from-bottom-2 delay-100">
                Your feedback helps me build better tools. I really appreciate you taking the time.
              </p>
            </>
          )}
        </div>
        

      </DialogContent>
      
      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes gentleShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-2px); }
          40% { transform: translateX(2px); }
          60% { transform: translateX(-1px); }
          80% { transform: translateX(1px); }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes collapse {
          0% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          50% {
            opacity: 0.5;
            transform: scale(0.8) translateY(-10px);
          }
          100% {
            opacity: 0;
            transform: scale(0.6) translateY(-20px);
          }
        }
        
        .animate-collapse {
          animation: collapse 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
      `}</style>
    </Dialog>
  );
};

export default AboutMeModal;
