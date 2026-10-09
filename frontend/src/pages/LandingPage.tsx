import React from 'react';
import { LandingPage as CinematicLandingPage, LandingPageProps } from './Landing/LandingPage';

export type { LandingPageProps };

export const LandingPage: React.FC<LandingPageProps> = (props) => {
  return <CinematicLandingPage {...props} />;
};

export default LandingPage;
