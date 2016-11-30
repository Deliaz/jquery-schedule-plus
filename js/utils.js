export function calcStringTime(string) {
    let slice = string.split(':');
    let h = Number(slice[0]) * 60 * 60;
    let i = Number(slice[1]) * 60;
    let min = h + i;

    return min;
}

export function nextTenMinutes(timeString) {
    return formatTime(calcStringTime(timeString) + 600);
}

export function formatTime(min) {
    let h = "" + (min / 36000 | 0) + (min / 3600 % 10 | 0);
    let i = "" + (min % 3600 / 600 | 0) + (min % 3600 / 60 % 10 | 0);
    let string = h + ":" + i;

    return string;
}