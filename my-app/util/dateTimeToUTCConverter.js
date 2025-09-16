function getUTCDateAndTime(date) {
    return date.toISOString().split('T');
}

function formatToGBLocale(date) {
    return date.toLocaleDateString("en-GB");
}

export { 
    getUTCDateAndTime as getUTC, 
    formatToGBLocale,
};