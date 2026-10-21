import React from 'react';

const DeployBanner: React.FC = () => {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev';
  return (
    <div
      id="deploy-banner"
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        background: '#111',
        color: '#fff',
        padding: '4px 8px',
        fontSize: '12px',
        zIndex: 9999,
        borderTopLeftRadius: '4px',
      }}
    >
      Build #{commit}
    </div>
  );
};

export default DeployBanner;
