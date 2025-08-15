import React from 'react';
import { Navigate } from 'react-router-dom';
import { useTeam } from '@/contexts/TeamContext';
import TeamOnboarding from '@/components/TeamOnboarding';

const Auth = () => {
  const { isInTeam } = useTeam();

  // Redirect if already in a team
  if (isInTeam) {
    return <Navigate to="/" replace />;
  }

  return <TeamOnboarding />;
};

export default Auth;
