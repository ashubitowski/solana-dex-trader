// Validation rules for configuration form
export const validateConfig = (config: any) => {
  const errors: Record<string, string> = {};
  
  // Trading parameters validation
  if (config.minimumLiquidity <= 0) {
    errors.minimumLiquidity = 'Must be greater than 0';
  }
  
  if (config.tradeAmount <= 0) {
    errors.tradeAmount = 'Must be greater than 0';
  }
  
  if (config.slippageTolerance < 0.1) {
    errors.slippageTolerance = 'Must be at least 0.1%';
  } else if (config.slippageTolerance > 10) {
    errors.slippageTolerance = 'Must not exceed 10%';
  }
  
  if (config.maxActivePositions < 1) {
    errors.maxActivePositions = 'Must have at least 1 position';
  } else if (config.maxActivePositions > 20) {
    errors.maxActivePositions = 'Cannot exceed 20 positions';
  }
  
  if (config.takeProfit < 1) {
    errors.takeProfit = 'Must be at least 1%';
  }
  
  if (config.stopLoss < 1) {
    errors.stopLoss = 'Must be at least 1%';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Helper to check if a field has an error
export const hasError = (errors: Record<string, string>, field: string): boolean => {
  return Object.prototype.hasOwnProperty.call(errors, field);
};

// Helper to get error message for a field
export const getErrorMessage = (errors: Record<string, string>, field: string): string => {
  return errors[field] || '';
};
