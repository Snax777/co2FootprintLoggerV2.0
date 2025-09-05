function getUTCDateAndTime(date) {
    return date.toISOString().split('T');
}

export { getUTCDateAndTime as getUTC };