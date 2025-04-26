import React from 'react';

const Positions: React.FC = () => {
  return (
    <>
      <h1 className="text-3xl font-bold text-gray-800 mb-4">Positions</h1>
      <div className="bg-white rounded-lg shadow-card p-6">
        <h2 className="text-lg font-bold text-textMain mb-4">Current Positions</h2>
        <p>Your active and historical trading positions will appear here.</p>
      </div>
    </>
  );
};

export default Positions;
