'use client';

import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';

export default function ProgressBarProvider() {
  return (
    <ProgressBar
      height="2px"
      color="#0d9488"
      options={{ showSpinner: false }}
      shallowRouting
    />
  );
}
