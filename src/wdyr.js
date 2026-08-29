import React from 'react';
import wdyr from '@welldone-software/why-did-you-render';

// if (process.env.NODE_ENV === 'development') {
  wdyr(React, {
    // include: [/.*/],
    trackHooks: true,
    trackAllPureComponents: true,
  });
// }
