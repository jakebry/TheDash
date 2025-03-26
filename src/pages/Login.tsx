import { useState, useEffect, useRef } from 'react';
import { useAuth } from "../contexts/useAuth"; // ✅ Correct
import { MessageSquare, ChevronRight, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [step, setStep] = useState(1);
  const [modeTransitioning, setModeTransitioning] = useState(false);
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  
  const { signIn, signUp } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [formHeight, setFormHeight] = useState('auto');
  const [animating, setAnimating] = useState(false);
  const initialRender = useRef(true);

  // Lists for dropdown selections
  const countries = ['Canada', 'United States'];
  const canadianProvinces = [
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 
    'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia', 
    'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 
    'Saskatchewan', 'Yukon'
  ];
  const usStates = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 
    'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 
    'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 
    'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 
    'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 
    'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 
    'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 
    'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 
    'West Virginia', 'Wisconsin', 'Wyoming'
  ];

  // Reset step when toggling between sign in/sign up
  useEffect(() => {
    if (!modeTransitioning) {
      setStep(1);
    }
  }, [isSignUp, modeTransitioning]);

  // Update height when switching between modes or steps
  useEffect(() => {
    // Skip initial render
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    if (formRef.current) {
      // Start animation sequence
      setAnimating(true);
      
      // First set a fixed starting height
      const currentHeight = formRef.current.offsetHeight;
      setFormHeight(`${currentHeight}px`);
      
      // Force browser to process the fixed height and set the target height immediately
      requestAnimationFrame(() => {
        if (formRef.current) {
          const targetHeight = formRef.current.scrollHeight;
          setFormHeight(`${targetHeight}px`);
          
          // End animation after transition completes
          setTimeout(() => {
            setAnimating(false);
            setFormHeight('auto');
          }, 250); // Slightly faster transition for better fluidity
        }
      });
    }
  }, [isSignUp, step, country]);

  // Country change handler
  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCountry = e.target.value;
    setCountry(selectedCountry);
    setRegion(''); // Reset region when country changes
  };

  // Step navigation
  const nextStep = () => {
    // Basic validation
    if (step === 1) {
      if (isSignUp && password !== confirmPassword) {
        toast.error("Passwords don't match");
        return;
      }
    }
    
    if (!animating) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (!animating && step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (isSignUp && step < 3) {
      nextStep();
      return;
    }

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          toast.error("Passwords don't match");
          return;
        }
        
        if (!phoneNumber || !country || !region) {
          toast.error("Please complete all fields");
          return;
        }

        await signUp(email, password, {
          full_name: fullName,
          role: 'user'
        });
        
        toggleMode(false);
      } else {
        await signIn(email, password);
        toast.success('Welcome back!');
      }
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message.includes('User already registered')
          ? 'This email is already registered. Please sign in instead.'
          : error.message
        : 'An unexpected error occurred';
      
      toast.error(errorMessage, {
        duration: 4000,
        style: {
          background: '#FF6B6B',
          color: '#fff',
          borderRadius: '10px',
        },
      });
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setPhoneNumber('');
    setCountry('');
    setRegion('');
    setStep(1);
  };

  const toggleMode = (newMode?: boolean) => {
    // Only toggle if not currently animating
    if (!animating && !modeTransitioning) {
      // Start the transition animation
      setModeTransitioning(true);
      
      if (containerRef.current) {
        containerRef.current.classList.add('scale-105', 'opacity-95');
        
        setTimeout(() => {
          // Set the new mode
          setIsSignUp(typeof newMode !== 'undefined' ? newMode : !isSignUp);
          resetForm();
          
          // Let the DOM update with new mode before continuing the animation
          requestAnimationFrame(() => {
            if (containerRef.current) {
              containerRef.current.classList.remove('scale-105', 'opacity-95');
              
              // End the animation after transition completes
              setTimeout(() => {
                setModeTransitioning(false);
              }, 250);
            }
          });
        }, 200);
      }
    }
  };

  // Common input class with improved styling
  const inputClass = `w-full px-4 py-2.5 rounded-xl bg-light-blue border-2 border-highlight-blue text-white 
    transition-all duration-200 focus:outline-none focus:border-coral-orange focus:ring-2 focus:ring-coral-orange/30 
    placeholder-gray-500 shadow-inner`;

  // Render step content based on current step
  const renderStepContent = () => {
    if (!isSignUp) {
      // Login form
      return (
        <>
          <div className="transition-all duration-300 ease-out">
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div className="transition-all duration-300 ease-out">
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              required
            />
          </div>
        </>
      );
    }

    // Sign up form steps
    switch (step) {
      case 1:
        return (
          <>
            <div className="transition-all duration-300 ease-out">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div className="transition-all duration-300 ease-out">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div className="transition-all duration-300 ease-out">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div className="transition-all duration-300 ease-out">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </>
        );
      case 2:
        return (
          <>
            <div className="transition-all duration-300 ease-out">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div className="transition-all duration-300 ease-out">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Country
              </label>
              <select
                value={country}
                onChange={handleCountryChange}
                className={inputClass}
                required
              >
                <option value="">Select Country</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {country && (
              <div className="transition-all duration-300 ease-out transform-gpu">
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  {country === 'Canada' ? 'Province/Territory' : 'State'}
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Select {country === 'Canada' ? 'Province/Territory' : 'State'}</option>
                  {country === 'Canada'
                    ? canadianProvinces.map((province) => (
                        <option key={province} value={province}>
                          {province}
                        </option>
                      ))
                    : usStates.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                </select>
              </div>
            )}
          </>
        );
      case 3:
        return (
          <div className="space-y-4 transition-all duration-300 ease-out">
            <h3 className="text-xl font-semibold text-white text-center">Review Your Information</h3>
            
            <div className="bg-light-blue/30 p-4 rounded-xl space-y-2">
              <p><span className="text-gray-400">Name:</span> <span className="text-white">{fullName}</span></p>
              <p><span className="text-gray-400">Email:</span> <span className="text-white">{email}</span></p>
              <p><span className="text-gray-400">Phone:</span> <span className="text-white">{phoneNumber}</span></p>
              <p><span className="text-gray-400">Location:</span> <span className="text-white">{region}, {country}</span></p>
            </div>
            
            <p className="text-sm text-gray-400 text-center">
              Please confirm your information is correct before completing signup.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  // Render step indicator for multi-step form
  const renderStepIndicator = () => {
    if (!isSignUp) return null;
    
    return (
      <div className="flex justify-center mb-6">
        {[1, 2, 3].map((s) => (
          <div 
            key={s} 
            className={`w-3 h-3 mx-1 rounded-full transition-all duration-300 ${
              s === step 
                ? 'bg-neon-blue scale-125' 
                : s < step 
                  ? 'bg-neon-blue/60' 
                  : 'bg-gray-600'
            }`}
          />
        ))}
      </div>
    );
  };

  // Render action buttons based on current mode and step
  const renderActionButtons = () => {
    const buttonClass = `py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center
      disabled:opacity-50 disabled:cursor-not-allowed`;
    
    if (!isSignUp) {
      return (
        <button
          type="submit"
          className={`w-full bg-neon-blue text-white ${buttonClass} hover:bg-blue-600 hover:shadow-md mt-2`}
        >
          Sign In
        </button>
      );
    }

    return (
      <div className="flex gap-2 mt-2">
        {step > 1 && (
          <button
            type="button"
            onClick={prevStep}
            className={`flex-1 bg-highlight-blue text-white ${buttonClass} hover:bg-light-blue`}
            disabled={animating}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </button>
        )}
        
        <button
          type="submit"
          className={`flex-1 bg-neon-blue text-white ${buttonClass} hover:bg-blue-600 hover:shadow-md`}
          disabled={animating}
        >
          {step < 3 ? (
            <>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </>
          ) : (
            'Complete Signup'
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-dark-blue flex items-center justify-center p-4">
      <div 
        ref={containerRef}
        className={`bg-highlight-blue p-8 rounded-xl shadow-xl max-w-md w-full 
          transition-all duration-250 ease-out will-change-transform ${
          animating || modeTransitioning ? 'shadow-2xl' : ''
        }`}
      >
        <div className="flex items-center gap-2 justify-center mb-4">
          <MessageSquare className="w-10 h-10 text-neon-blue" />
          <h1 className="text-2xl font-bold text-white">WestEdge Solutions</h1>
        </div>
        
        {renderStepIndicator()}

        <form 
          ref={formRef}
          onSubmit={handleSubmit} 
          className="space-y-4 overflow-hidden transition-all duration-250 ease-out will-change-[height]"
          style={{ height: formHeight }}
        >
          {renderStepContent()}
          {renderActionButtons()}
        </form>

        <p className="mt-4 text-center text-gray-300">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => toggleMode()}
            className={`text-neon-blue hover:underline transition-colors ${
              animating || modeTransitioning ? 'pointer-events-none opacity-75' : ''
            }`}
            disabled={animating || modeTransitioning}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}