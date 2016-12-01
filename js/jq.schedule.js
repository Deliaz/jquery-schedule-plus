import * as Utils from './utils';
import webuiPopoverConfGetter from './webui-popover-conf';
import SELECTORS from './selectors';

// TODO move to tools
$.fn.docPosition = function (element) {
    if (element.jquery) element = element[0];

    var position = this[0].compareDocumentPosition(element);

    if (position & 0x04) return 'after';
    if (position & 0x02) return 'before';
};

$.fn.serializeObject = function()
{
    var o = {};
    var a = this.serializeArray();
    $.each(a, function() {
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
};


$.fn.timeSchedule = function (options) {
    const defaults = {
        rows: {},
        startTime: "07:00",
        endTime: "19:30",
        widthTimeX: 25,		// Width per cell (px)
        widthTime: 600,		// Separation time (sec)
        timeLineY: 50,		// timeline height(px)
        timeLineBorder: 1,	// timeline height border
        timeBorder: 1,		// border width
        timeLinePaddingTop: 0,
        timeLinePaddingBottom: 3,
        headTimeBorder: 0,	// time border width
        dataWidth: 160,		// data width
        verticalScrollbar: 0,	// vertical scrollbar width

        // event
        init_data: null,
        change: null,
        click: null,
        append: null,
        time_click: null,
        debug: ""			// debug selector
    };

    let setting = $.extend(defaults, options);
    this.setting = setting;
    let scheduleData = [];
    let timelineData = [];
    let $element = $(this);
    let element = (this);
    let tableStartTime = Utils.calcStringTime(setting.startTime);
    let tableEndTime = Utils.calcStringTime(setting.endTime);
    let currentNode = null;
    let editableNode = null;

    tableStartTime -= (tableStartTime % setting.widthTime);
    tableEndTime -= (tableEndTime % setting.widthTime);

    /**
     * Return timeline data
     * Public
     * @returns {Array}
     */
    this.getTimelineData = function () {
        return timelineData;
    };

    // Get the current timeline number
    this.getTimeLineNumber = function (top) {
        let num = 0;
        let n = 0;
        let tn = Math.ceil(top / (setting.timeLineY + setting.timeLinePaddingTop + setting.timeLinePaddingBottom));
        setting.rows.forEach(function (val) {
            let r = val;
            let tr = 0;
            if (typeof r["schedule"] == Object) {
                tr = r["schedule"].length;
            }
            if (currentNode && currentNode["timeline"]) {
                tr++;
            }
            n += Math.max(tr, 1);
            if (n >= tn) {
                return;
            }
            num++;
        });

        return num;
    };

    /**
     * Add new event to timeline
     * Public
     * @param data
     * @param {boolean} isManuallyNew if it was set manually
     */
    this.addNewEvent = function (data, isManuallyNew) {

        let convertedData = {
            "timeline": data.timeline || 0,
            "start": Utils.calcStringTime(data.start),
            "end": Utils.calcStringTime(data.end),
            "text": data.text,
            "data": data.data
        };

        this.addScheduleData(convertedData, isManuallyNew);
    };

    /**
     * Add new event with converted data
     * @param data {object} Converted data (see this.addNewEvent)
     * @param [isManuallyNew] {boolean}
     * @returns {number}
     */
    this.addScheduleData = function (data, isManuallyNew = false) {
        let st = Math.ceil((data["start"] - tableStartTime) / setting.widthTime);
        let et = Math.floor((data["end"] - tableStartTime) / setting.widthTime);
        let $bar = $('<div class="sc_Bar"><span class="head"><span class="time"></span></span><span class="text"></span></div>');
        let stext = Utils.formatTime(data["start"]);
        let etext = Utils.formatTime(data["end"]);
        let snum = data["timeline"];
        $bar.css({
            left: (st * setting.widthTimeX),
            top: 0, //((snum * setting.timeLineY) + setting.timeLinePaddingTop), // это влияет на отступ блока внутри собственного таймлайна. тупо что он отличный был от нуля
            width: ((et - st) * setting.widthTimeX),
            height: (setting.timeLineY)
        });
        $bar.find(".time").text(stext + "-" + etext);
        if (data["text"]) {
            $bar.find(".text").text(data["text"]);
        }
        if (data["class"]) {
            $bar.addClass(data["class"]);
        }
        //$element.find('.sc_main').append($bar);
        $element.find('.sc_main .timeline').eq(data["timeline"]).append($bar);

        // Add data
        scheduleData.push(data);
        // key
        let key = scheduleData.length - 1;
        $bar.data("sc_key", key);


        $bar.on("mouseup", function () {
            let $this = $(this);

            if ($this.data("dragCheck") !== true && $(this).data("resizeCheck") !== true) {
                let sc_key = $this.data("sc_key");
                let eventData = scheduleData[sc_key];

                // Show this event settings
                showEventSettings($this, eventData);

                // Run 'click' callback if it was set
                if (typeof setting.click === 'function') {
                    setting.click($this, eventData);
                }
            }
        });

        // Set event popover with it's settings
        $bar.webuiPopover(webuiPopoverConfGetter($element));
        if (isManuallyNew) {
            editableNode = $bar;
            $bar.webuiPopover('show');

            $element
                .find(SELECTORS.eventTitleInput)
                .focus();
        }


        let $node = $element.find(".sc_Bar");
        // move node.
        $node.draggable({
            grid: [setting.widthTimeX, 1],
            containment: ".sc_main",
            helper: 'original',
            start: function (event, ui) {
                let node = {};
                node["node"] = this;
                node["offsetTop"] = ui.position.top;
                node["offsetLeft"] = ui.position.left;
                node["currentTop"] = ui.position.top;
                node["currentLeft"] = ui.position.left;
                node["timeline"] = element.getTimeLineNumber(ui.position.top);
                node["nowTimeline"] = node["timeline"];
                currentNode = node;
            },
            drag: function (event, ui) {
                $(this).data("dragCheck", true);
                if (!currentNode) {
                    return false;
                }
                let $moveNode = $(this);
                let sc_key = $moveNode.data("sc_key");
                let originalTop = ui.originalPosition.top;
                let originalLeft = ui.originalPosition.left;
                let positionTop = ui.position.top;
                let positionLeft = ui.position.left;
                let timelineNum = element.getTimeLineNumber(ui.position.top);
                // fix position
                //ui.position.top = Math.floor(ui.position.top / setting.timeLineY) * setting.timeLineY;
                //ui.position.top = element.getScheduleCount(timelineNum) * setting.timeLineY;
                ui.position.left = Math.floor(ui.position.left / setting.widthTimeX) * setting.widthTimeX;


                //$moveNode.find(".text").text(timelineNum+" "+(element.getScheduleCount(timelineNum) + 1));
                if (currentNode["nowTimeline"] != timelineNum) {
                    // Adjust height
                    //element.resizeRow(currentNode["nowTimeline"],element.getScheduleCount(currentNode["nowTimeline"]));
                    //element.resizeRow(timelineNum,element.getScheduleCount(timelineNum) + 1);
                    // Current timeline
                    currentNode["nowTimeline"] = timelineNum;
                } else {
                    //ui.position.top = currentNode["currentTop"];
                }
                currentNode["currentTop"] = ui.position.top;
                currentNode["currentLeft"] = ui.position.left;
                // Text change
                element.rewriteBarText($moveNode, scheduleData[sc_key]);
                return true;
            },
            // Processing after element movement has ended
            stop: function (event, ui) {
                $(this).data("dragCheck", false);
                currentNode = null;

                let node = $(this);
                let sc_key = node.data("sc_key");
                let x = node.position().left;
                let w = node.width();

                let start = tableStartTime + (Math.floor(x / setting.widthTimeX) * setting.widthTime);
                // let end = tableStartTime + (Math.floor((x + w) / setting.widthTimeX) * setting.widthTime);
                let end = start + ((scheduleData[sc_key]["end"] - scheduleData[sc_key]["start"]));

                scheduleData[sc_key]["start"] = start;
                scheduleData[sc_key]["end"] = end;
                // Call back if callback is set
                if (setting.change) {
                    setting.change(node, scheduleData[sc_key]);
                }
            }
        });
        $node.resizable({
            handles: 'e, w', // East (right) and West (left),
            grid: [setting.widthTimeX, setting.timeLineY],
            minWidth: setting.widthTimeX,
            start: function (event, ui) {
                let node = $(this);
                node.data("resizeCheck", true);
            },
            // Processing after element movement has ended
            stop: function (event, ui) {
                let node = $(this);
                let sc_key = node.data("sc_key");
                let x = node.position().left;
                let w = node.width();
                let start = tableStartTime + (Math.floor(x / setting.widthTimeX) * setting.widthTime);
                let end = tableStartTime + (Math.floor((x + w) / setting.widthTimeX) * setting.widthTime);
                let timelineNum = scheduleData[sc_key]["timeline"];

                scheduleData[sc_key]["start"] = start;
                scheduleData[sc_key]["end"] = end;

                // Height adjustment
                element.resetBarPosition(timelineNum);
                // Text change
                element.rewriteBarText(node, scheduleData[sc_key]);

                node.data("resizeCheck", false);
                // Call back if callback is set
                if (setting.change) {
                    setting.change(node, scheduleData[sc_key]);
                }
            }
        });
        return key;
    };
    // Acquire schedule number
    this.getScheduleCount = function (n) {
        let num = 0;
        for (let i in scheduleData) {
            if (scheduleData[i]["timeline"] == n) {
                num++;
            }
        }
        return num;
    };


    /**
     * Show settings for an event and set title
     * @param $bar {object} jQuery element
     * @param eventData {event} Event Data
     */
    function showEventSettings($bar, eventData) {
        editableNode = $bar;
        $bar.webuiPopover('show');
        $element.find(SELECTORS.eventTitleInput).val(eventData.text);
    }

    // add
    this.addRow = function (timeline, row) {
        let title = row["title"];
        let id = $element.find('.sc_main .timeline').length;

        let html;

        html = '';
        html += '<div class="timeline"><span>' + title + '</span></div>';
        let $data = $(html);
        // event call
        if (setting.init_data) {
            setting.init_data($data, row);
        }
        $element.find('.sc_data_scroll').append($data);

        html = '';
        html += '<div class="timeline"></div>';

        let $timeline = $(html);
        $timeline.data('timeline-number', id);

        for (let t = tableStartTime; t < tableEndTime; t += setting.widthTime) {
            let $tl = $('<div class="tl"></div>');
            $tl.width(setting.widthTimeX - setting.timeBorder);

            $tl.data("time", Utils.formatTime(t));
            $tl.data("timeline", timeline);
            $timeline.append($tl);
        }


        //
        // Timeline events
        //

        let $tlItem = $timeline.find(".tl"); // TODO в пределах всего виджета а не толко таймлайна
        let lastMovedTarget = null;
        let $startEl = null;

        $tlItem
            .on('mousedown', function () {
                if (!$startEl) {
                    let $this = $(this);
                    $startEl = $this;

                    // Hide all event popovers
                    WebuiPopovers.hideAll();

                    $tlItem.removeClass('marked-for-new-event');
                    $startEl.addClass('marked-for-new-event');
                }
            })
            .on('mouseup', () => {
                if ($startEl) {
                    $startEl = null;

                    let $selectedTimeItems = $timeline.find('.tl.marked-for-new-event');
                    if ($selectedTimeItems.size()) {
                        $tlItem.removeClass('marked-for-new-event');

                        let startTime = $selectedTimeItems.first().data('time');
                        let preEndTime = $selectedTimeItems.last().data('time'); //cuz this start of the element time
                        let endTime = Utils.nextTenMinutes(preEndTime);

                        this.addNewEvent({
                            start: startTime,
                            end: endTime,
                            timeline: $timeline.data('timeline-number')
                        }, true); // with "true" will show event settings popover
                    }
                }
            });

        $tlItem.on('mousemove', function (e) { // mouse move while clicked right mouse btn
            if (e.buttons === 1 && lastMovedTarget !== e.target) {
                let $this = $(this);

                lastMovedTarget = e.target; // cuz it doesn't work with $this

                let $elementsForSelect;
                let elementPosition = $this.docPosition($startEl);

                if (elementPosition === 'before') {
                    $elementsForSelect = $startEl.nextUntil($this);
                } else if (elementPosition === 'after') {
                    $elementsForSelect = $startEl.prevUntil($this);
                }

                if ($elementsForSelect) {
                    $tlItem.removeClass('marked-for-new-event');
                    $elementsForSelect.addClass('marked-for-new-event');
                }
                $startEl.addClass('marked-for-new-event');
                $this.addClass('marked-for-new-event');
            } else if (e.buttons === 0) {
                $startEl = false;
                // TODO show new event dialog ?
            }
        });

        // click event
        if (setting.time_click) {
            $tlItem.on('click', function () { // regular click
                setting.time_click(this, $(this).data("time"), $(this).data("timeline"), timelineData[$(this).data("timeline")]);
            });
        }


        $element.find('.sc_main').append($timeline);

        timelineData[timeline] = row;

        if (row["class"] && (row["class"] != "")) {
            $element.find('.sc_data .timeline').eq(id).addClass(row["class"]);
            $element.find('.sc_main .timeline').eq(id).addClass(row["class"]);
        }

        // Schedule timeline
        if (row["schedule"]) {
            for (let i in row["schedule"]) {
                let bdata = row["schedule"][i];
                let s = Utils.calcStringTime(bdata["start"]);
                let e = Utils.calcStringTime(bdata["end"]);

                let data = {};
                data["timeline"] = id;
                data["start"] = s;
                data["end"] = e;
                if (bdata["text"]) {
                    data["text"] = bdata["text"];
                }
                data["data"] = {};
                if (bdata["data"]) {
                    data["data"] = bdata["data"];
                }
                element.addScheduleData(data);
            }
        }

        // Adjust height
        element.resetBarPosition(id);
        $element.find('.sc_main .timeline').eq(id).droppable({
            accept: ".sc_Bar",
            drop: function (ev, ui) {
                let node = ui.draggable;
                let sc_key = node.data("sc_key");
                let nowTimelineNum = scheduleData[sc_key]["timeline"];
                let timelineNum = $element.find('.sc_main .timeline').index(this);
                // change timeline
                scheduleData[sc_key]["timeline"] = timelineNum;
                node.appendTo(this);
                // Height adjustment
                element.resetBarPosition(nowTimelineNum);
                element.resetBarPosition(timelineNum);
            }
        });

        // Call back if callback is set
        if (setting.append) {
            $element.find('.sc_main .timeline').eq(id).find(".sc_Bar").each(function () {
                let node = $(this);
                let sc_key = node.data("sc_key");
                setting.append(node, scheduleData[sc_key]);
            });
        }
    };

    /**
     * Return schedule data
     * Public
     * @returns {Array}
     */
    this.getScheduleData = function () {
        let data = [];

        for (let i in timelineData) {
            if (typeof timelineData[i] == "undefined") continue;
            let timeline = $.extend(true, {}, timelineData[i]);
            timeline.schedule = [];
            data.push(timeline);
        }

        for (let i in scheduleData) {
            if (typeof scheduleData[i] == "undefined") continue;
            let schedule = $.extend(true, {}, scheduleData[i]);
            schedule.start = Utils.formatTime(schedule.start);
            schedule.end = Utils.formatTime(schedule.end);
            let timelineIndex = schedule.timeline;
            delete schedule.timeline;
            data[timelineIndex].schedule.push(schedule);
        }

        return data;
    };

    // Change text
    this.rewriteBarText = function (node, data) {
        let x = node.position().left;
        let w = node.width();
        let start = tableStartTime + (Math.floor(x / setting.widthTimeX) * setting.widthTime);
        //let end = tableStartTime + (Math.floor((x + w) / setting.widthTimeX) * setting.widthTime);
        let end = start + (data["end"] - data["start"]);
        let html = Utils.formatTime(start) + "-" + Utils.formatTime(end);
        $(node).find(".time").html(html);
    };
    this.resetBarPosition = function (n) {
        // reorder elements
        let $bar_list = $element.find('.sc_main .timeline').eq(n).find(".sc_Bar");
        let codes = [];
        for (let i = 0; i < $bar_list.length; i++) {
            codes[i] = {code: i, x: $($bar_list[i]).position().left};
        }

        // Sort
        codes.sort(function (a, b) {
            if (a["x"] < b["x"]) {
                return -1;
            } else if (a["x"] > b["x"]) {
                return 1;
            }
            return 0;
        });
        let check = [];
        let h = 0;
        let $e1, $e2;
        let c1, c2;
        let s1, e1, s2, e2;
        for (let i = 0; i < codes.length; i++) {
            c1 = codes[i]["code"];
            $e1 = $($bar_list[c1]);
            for (h = 0; h < check.length; h++) {
                let next = false;
                L: for (let j = 0; j < check[h].length; j++) {
                    c2 = check[h][j];
                    $e2 = $($bar_list[c2]);

                    s1 = $e1.position().left;
                    e1 = $e1.position().left + $e1.width();
                    s2 = $e2.position().left;
                    e2 = $e2.position().left + $e2.width();
                    if (s1 < e2 && e1 > s2) {
                        next = true;
                        continue L;
                    }
                }
                if (!next) {
                    break;
                }
            }
            if (!check[h]) {
                check[h] = [];
            }
            $e1.css({top: ((h * setting.timeLineY) + setting.timeLinePaddingTop)});
            check[h][check[h].length] = c1;
        }
        // Adjust height
        this.resizeRow(n, check.length);
    };
    this.resizeRow = function (n, height) {
        //let h = Math.max(element.getScheduleCount(n),1);
        let h = Math.max(height, 1);
        $element.find('.sc_data .timeline').eq(n).height((h * setting.timeLineY) - setting.timeLineBorder + setting.timeLinePaddingTop + setting.timeLinePaddingBottom);
        $element.find('.sc_main .timeline').eq(n).height((h * setting.timeLineY) - setting.timeLineBorder + setting.timeLinePaddingTop + setting.timeLinePaddingBottom);

        $element.find('.sc_main .timeline').eq(n).find(".sc_bgBar").each(function () {
            $(this).height($(this).closest(".timeline").height());
        });

        $element.find(".sc_data").height($element.find(".sc_main_box").height());
    };
    // resizeWindow
    this.resizeWindow = function () {
        let sc_width = $element.width();
        let sc_main_width = sc_width - setting.dataWidth - (setting.verticalScrollbar);
        let cell_num = Math.floor((tableEndTime - tableStartTime) / setting.widthTime);
        $element.find(".sc_header_cell").width(setting.dataWidth);
        $element.find(".sc_data,.sc_data_scroll").width(setting.dataWidth);
        $element.find(".sc_header").width(sc_main_width);
        $element.find(".sc_main_box").width(sc_main_width);
        $element.find(".sc_header_scroll").width(setting.widthTimeX * cell_num);
        $element.find(".sc_main_scroll").width(setting.widthTimeX * cell_num);

    };

    /**
     * Start point
     */
    this.init = function () {
        this.renderData();
        this.changeEventHandler();
    };

    this.renderData = function () {
        let html = '';
        html += '<div class="sc_menu">' + "\n";
        html += '<div class="sc_header_cell"><span>&nbsp;</span></div>' + "\n";
        html += '<div class="sc_header">' + "\n";
        html += '<div class="sc_header_scroll">' + "\n";
        html += '</div>' + "\n";
        html += '</div>' + "\n";
        html += '<br class="clear" />' + "\n";
        html += '</div>' + "\n";
        html += '<div class="sc_wrapper">' + "\n";
        html += '<div class="sc_data">' + "\n";
        html += '<div class="sc_data_scroll">' + "\n";
        html += '</div>' + "\n";
        html += '</div>' + "\n";
        html += '<div class="sc_main_box">' + "\n";
        html += '<div class="sc_main_scroll">' + "\n";
        html += '<div class="sc_main">' + "\n";
        html += '</div>' + "\n";
        html += '</div>' + "\n";
        html += '</div>' + "\n";
        html += '<br class="clear" />' + "\n";
        html += '</div>' + "\n";

        $element.append(html); // TODO should it be .html ?

        $element.find(".sc_main_box").scroll(function () {
            $element.find(".sc_data_scroll").css("top", $(this).scrollTop() * -1);
            $element.find(".sc_header_scroll").css("left", $(this).scrollLeft() * -1);
        });

        // add time cell
        let cell_num = Math.floor((tableEndTime - tableStartTime) / setting.widthTime);
        let before_time = -1;
        for (let t = tableStartTime; t < tableEndTime; t += setting.widthTime) {

            if (
                (before_time < 0) ||
                (Math.floor(before_time / 3600) != Math.floor(t / 3600))) {

                let html = '';
                html += '<div class="sc_time">' + Utils.formatTime(t) + '</div>';
                let $time = $(html);
                let cell_num = Math.floor(Number(Math.min((Math.ceil((t + setting.widthTime) / 3600) * 3600), tableEndTime) - t) / setting.widthTime);
                $time.width((cell_num * setting.widthTimeX) - setting.headTimeBorder);
                $element.find(".sc_header_scroll").append($time);

                before_time = t;
            }
        }

        $(window).resize(function () {
            element.resizeWindow();
        }).trigger("resize");

        // addrow

        setting.rows.forEach(function (val, i) {
            this.addRow(i, val);
        }.bind(this));
    };

    this.changeEventHandler = () => {
        $element.on('submit', SELECTORS.eventChangeForm, function(e) {
            e.preventDefault();

            if(editableNode) {
                let dataToSave = $(this).serializeObject(); // заголовок - поле title
                let sc_key = editableNode.data("sc_key");
                let eventData = scheduleData[sc_key];
                if(!eventData) {
                    throw new Error('Editable event not found');
                }
                eventData.text = dataToSave.title;

                // Update memory data
                scheduleData[sc_key] = eventData;

                // Update UI data
                editableNode.find('.text').text(eventData.text);

                // Hide event settings
                editableNode.webuiPopover('hide');

                editableNode = null;
            } else {
                throw new Error('Editable node not specified');
            }
        });

        $element.on('click', SELECTORS.eventDeleteBtn, () => {
            let sc_key = editableNode.data("sc_key");
            delete(scheduleData[sc_key]); // delete will save keys

            // Hide settings popover
            editableNode.webuiPopover('hide');

            // Delete from UI
            editableNode.off();
            editableNode.remove();

            editableNode = null;
        });
    };

    // Initialization
    this.init();

    this.debug = function () {
        let html = '';
        for (let i in scheduleData) {
            let propsString = Object.keys(scheduleData[i]).map(k => `${k}: ${scheduleData[i][k]} `).join(' ');
            html += `<div style="font-size: smaller">[${i}] ${propsString}</div>`;
        }
        $(setting.debug).html(html);
    };
    if (setting.debug && setting.debug != "") {
        setInterval(function () {
            element.debug();
        }, 500);
    }

    return (this);
};
