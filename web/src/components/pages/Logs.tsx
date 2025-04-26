import React from 'react';

const Logs: React.FC = () => {
  return (
    <>
      <h1 className="text-3xl font-bold text-gray-800 mb-4">Logs</h1>
      <div className="bg-white rounded-lg shadow-card p-6">
        <h2 className="text-lg font-bold text-textMain mb-4">System Logs</h2>
        <p>Trading activity and system logs will appear here.</p>
      </div>
    </>
  );
};

export default Logs;
