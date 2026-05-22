import { useState } from 'react';

export const useGeoLocation = () => {
    const [isLocating, setIsLocating] = useState(false);
    const [geoError, setGeoError] = useState(null);

    const getPosition = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                const err = new Error('This browser does not support geolocation.');
                setGeoError(err.message);
                reject(err);
                return;
            }

            setIsLocating(true);
            setGeoError(null);

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setIsLocating(false);
                    resolve({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    });
                },
                (err) => {
                    setIsLocating(false);
                    let message = 'Unable to get your current location.';
                    if (err.code === 1) message = 'Location permission was denied.';
                    if (err.code === 2) message = 'The current position is unavailable.';
                    if (err.code === 3) message = 'Getting your location timed out.';
                    setGeoError(message);
                    reject(new Error(message));
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        });
    };

    return { getPosition, isLocating, geoError };
};
