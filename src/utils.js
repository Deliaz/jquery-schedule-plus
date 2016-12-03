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

export function docPosition(element1, element2) {
    if (element1.jquery) element1 = element1[0];
    if (element2.jquery) element2 = element2[0];

    var position = element1.compareDocumentPosition(element2);

    if (position & 0x04) {
        return 'after';
    }
    if (position & 0x02) {
        return 'before';
    }
}

export function serializeObject($form) {
    var o = {};
    var a = $form.serializeArray();
    $.each(a, function () {
        if (o[this.name] !== undefined) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
}