import { useState } from 'react';

export const useGeoLocation = () => {
    const [isLocating, setIsLocating] = useState(false);
    const [geoError, setGeoError] = useState(null);

    const getPosition = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                const err = new Error('您的浏览器不支持或已禁用地理位置服务');
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
                    let errMsg = '获取定位失败';
                    if (err.code === 1) errMsg = '定位权限被拒绝，请在浏览器设置中允许';
                    if (err.code === 2) errMsg = '无法获取当前位置（信号弱）';
                    if (err.code === 3) errMsg = '获取位置超时';
                    setGeoError(errMsg);
                    reject(new Error(errMsg));
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        });
    };

    return { getPosition, isLocating, geoError };
};