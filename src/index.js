import * as Utils from './utils';
import 'script-loader!./jquery.webui-popover.min.js';
import webuiPopoverConfGetter from './webui-popover-conf';
import SELECTORS from './selectors';

const tableLayoutHTML = require('./templates/table-layout.ejs')();
const tableHeaderHTML = require('./templates/table-header.ejs')();

require('./scss/main.scss');

const webUIPopoverTemplateFn = require('./templates/webui-popover.ejs');
const eventBarTemplateFn = require('./templates/event-bar.ejs');
const eventBarDataTemplateFn = require('./templates/event-bar-data.ejs');

$.fn.timeSchedule = function (barData) {
    const defaults = {
        rows: {},
        startTime: "10:00",
        endTime: "16:00",
        widthTimeX: 25,		// Width per cell (px)
        widthTime: 600,		// Separation time (sec)
        timeLineY: 90,		// timeline height(px)
        timeLineBorder: 4,	// timeline height border
        timeBorder: 1,		// border width
        timeLinePaddingTop: 0,
        timeLinePaddingBottom: 3,
        headTimeBorder: 0,	// time border width
        dataWidth: 160,		// data width
        verticalScrollbar: 20,	// vertical scrollbar width
        resizeBorderWidth: 4, // Resize border width
        seriesEvents: true, // allow few events in one row

        // events
        init_data: null,
        onChange: null,             // callback for submit and delete events
        click: null,
        append: null,
        time_click: null,

        // debug
        debugContainer: "",			// debug selector
        demoMode: false,            // run demo mode
        showTimeMark: false         // show time line and mark past time

    };

    let settings = $.extend(defaults, barData);
    this.settings = settings;
    let scheduleData = [];
    let timelineData = [];
    const $element = $(this);
    const element = (this);
    let tableStartTime = Utils.calcStringTime(settings.startTime);
    let tableEndTime = Utils.calcStringTime(settings.endTime);
    const eventFields = settings.fields || [];
    let currentNode = null;
    let editableNode = null;
    let currentTime = null;
    let currentTimeLeftBorder = null;
    let currentTimeMarkLeft = null; // TODO rename
    let fullRowsCount = null;
    let fullCellsCount = null;
    let minutePercentage = null;
    let lastMovedTarget = null;
    let $tlMoveStartEl = null;
    let $lastEditedBar = null;

    tableStartTime -= (tableStartTime % settings.widthTime);
    tableEndTime -= (tableEndTime % settings.widthTime);

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
        let tn = Math.ceil(top / (settings.timeLineY + settings.timeLinePaddingTop + settings.timeLinePaddingBottom));
        settings.rows.forEach(function (val) {
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
     * Calculates and returns date object from given node
     * @param $bar
     * @returns {{startTime: *, endTime: *}}
     */
    this.getBarTime = function ($bar) {
        let scKey = $bar.data('scKey');
        let x = $bar.position().left;
        let w = $bar.width();
        let startTime = tableStartTime + (Math.floor(x / settings.widthTimeX) * settings.widthTime);
        let endTime = tableStartTime + (Math.floor((x + w) / settings.widthTimeX) * settings.widthTime) + settings.widthTime;

        return {startTime, endTime};
    };

    this.isEventCanBeMoved = function ($bar) {
        let startTime = this.getBarTime($bar).startTime;
        return startTime > currentTime;
    };


    /**
     * Makes given event bar draggable
     * @param $node
     */
    this.makeNodeDraggable = function ($node) {
        $node.draggable({
            grid: [settings.widthTimeX, 1],
            containment: ".sc_main",
            helper: 'original',
            start: function (event, ui) {
                let node = {};
                node["node"] = this;
                node["offsetTop"] = ui.position.top;
                node["offsetLeft"] = ui.position.left;
                node["currentTop"] = ui.position.top;
                node["currentLeft"] = ui.position.left;
                node["timeline"] = element.getTimeLineNumber(ui.offset.top);
                node["nowTimeline"] = node["timeline"];

                currentNode = node;
            },
            drag: function (event, ui) {
                $(this).data("dragCheck", true);
                if (!currentNode) {
                    return false;
                }
                WebuiPopovers.hideAll();
                let $moveNode = $(this);

                let scKey = $moveNode.data("scKey");
                let timelineNum = element.getTimeLineNumber(ui.offset.top);


                // Uncomment if you want to get hard fixed position
                // ui.position.top = Math.floor(ui.position.top / settings.timeLineY) * settings.timeLineY;

                ui.position.left = Math.floor(ui.position.left / settings.widthTimeX) * settings.widthTimeX;

                // min position by current time
                if (ui.position.left <= currentTimeLeftBorder) {
                    ui.position.left = currentTimeLeftBorder;
                }

                if (currentNode["nowTimeline"] !== timelineNum) {
                    currentNode["nowTimeline"] = timelineNum;
                }
                currentNode["currentTop"] = ui.position.top;
                currentNode["currentLeft"] = ui.position.left;
                // Text change
                element.rewriteBarText($moveNode, scheduleData[scKey]);

                return true;
            },
            // Processing after element movement has ended
            stop: function (event, ui) {
                let $node = $(this);
                $node.data("dragCheck", false);

                $node.data({
                    originalLeft: ui.originalPosition.left,
                    originalTimeline: currentNode.timeline
                });

                currentNode = null;

                let scKey = $node.data("scKey");
                let x = $node.position().left;

                let start = tableStartTime + (Math.floor(x / settings.widthTimeX) * settings.widthTime);
                let end = start + ((scheduleData[scKey]["end"] - scheduleData[scKey]["start"]));

                showEventSettings($node, scheduleData[scKey]);

                scheduleData[scKey]["start"] = start;
                scheduleData[scKey]["end"] = end;
            }
        });
    };


    /**
     * Makes given event bar resizable
     * @param $node
     */
    this.makeNodeResizable = function ($node) {
        let self = this;
        $node.resizable({
            handles: 'e', // East (right) and West (left),
            grid: [settings.widthTimeX, settings.timeLineY],
            minWidth: settings.widthTimeX,
            containment: 'parent',
            start: function (event, ui) {
                let $node = $(this);
                if (ui.position.left <= currentTimeLeftBorder && event.toElement.matches('.ui-resizable-w')) {
                    $node.trigger('mouseup');
                    event.preventDefault();
                    $node.data("resizeCheck", false);
                    $node.removeClass('ui-resizable-resizing');
                    return false;
                }

                $node.data("resizeCheck", true);
            },
            resize: function (event, ui) {
                // let $node = $(this);
                // if (ui.position.left <= currentTimeLeftBorder
                //     && ($(event.toElement).position().left <= ui.position.left && !$(event.toElement).is('span.text')))  {
                //
                //     ui.position.left = currentTimeLeftBorder;
                //     ui.size.width = lastSuccessfullWidth;
                //     $node.data("resizeCheck", false);
                //     $node.removeClass('ui-resizable-resizing');
                //     $node.trigger('mouseup');
                //     return false;
                // }
                //
                // lastSuccessfulWidth = ui.size.width;
            },
            // Processing after element movement has ended
            stop: function (event, ui) {
                let $node = $(this);

                let scKey = $node.data("scKey");
                let time = self.getBarTime($node);
                let timelineNum = scheduleData[scKey]["timeline"];

                scheduleData[scKey]["start"] = time.startTime;
                scheduleData[scKey]["end"] = time.endTime;

                // Height adjustment
                element.resetBarPosition(timelineNum);
                // Text change
                element.rewriteBarText($node, scheduleData[scKey]);

                $node.data("resizeCheck", false);

                $node.data({
                    originalWidth: ui.originalSize.width
                });

                showEventSettings($node, scheduleData[scKey]);

                // Call back if callback is set
                if (settings.change) {
                    settings.change($node, scheduleData[scKey]);
                }
            }
        });
    };


    /**
     * Generate HTML for event bar
     * @param {object} barData
     * @return {string} HTML
     */
    this.generateBarDataHTML = function (barData) {
        let startTimeText = Utils.formatTime(barData["start"]);
        let endTimeText = Utils.formatTime(barData["end"]);

        return eventBarDataTemplateFn({
            timeText: `${startTimeText} - ${endTimeText}`,
            title: barData["text"] || '',
            manufacturer: barData.data["manufacturer"] || '',
            model: barData.data["model"] || '',
            number: barData.data["number"] || '',
            client_name: barData.data["client_name"] || '',
            client_phone: barData.data["client_phone"] || '',
        })
    };


    /**
     * Add new event with converted data
     * In case of manual adding consider to use ".addNewEvent"
     * @param barData {object} Converted data (see this.addNewEvent)
     * @param [isManuallyNew] {boolean}
     * @returns {number}
     */
    this.addScheduleData = function (barData, isManuallyNew = false) {
        let st = Math.ceil((barData["start"] - tableStartTime) / settings.widthTime);
        let et = Math.floor((barData["end"] - tableStartTime) / settings.widthTime);

        let positionFromLeft = st * settings.widthTimeX;

        barData.data = barData.data || {};
        let $bar = $(eventBarTemplateFn({
            barClass: barData["class"] || ''
        }));
        $bar.find('.event-bar-data').html(this.generateBarDataHTML(barData));

        $bar.css({
            left: positionFromLeft,
            top: 0, //((snum * settings.timeLineY) + settings.timeLinePaddingTop), // это влияет на отступ блока внутри собственного таймлайна. тупо что он отличный был от нуля
            width: ((et - st) * settings.widthTimeX - settings.resizeBorderWidth), //
            height: (settings.timeLineY)
        });

        $element.find('.sc_main .timeline').eq(barData["timeline"]).append($bar);

        barData.groupId = Utils.generateGUID();

        // Add data
        scheduleData.push(barData);

        // key
        let key = scheduleData.length - 1;
        $bar.data({
            scKey: key
        });

        // Events
        $bar.on('mouseup', function () { // 'function' bcuz we need 'this'
            let $this = $(this);

            if ($this.data('dragCheck') !== true && $(this).data('resizeCheck') !== true) {
                let scKey = $this.data('scKey');
                let eventData = scheduleData[scKey];
                let currentPositionFromLeft = $this.position().left;

                // Show this event settings
                showEventSettings($this, eventData, currentPositionFromLeft < currentTimeMarkLeft);

                // Run 'click' callback if it was set
                if (typeof settings.click === 'function') {
                    settings.click($this, eventData);
                }
            }
        });

        // Force create new event when mouse was entered on this event bar in creating mode
        $bar.on('mouseenter', () => {
            if ($tlMoveStartEl) {
                $tlMoveStartEl.trigger('mouseup');
                $tlMoveStartEl = null;
                lastMovedTarget = null;
            }
        });

        // Set event popover with it's settings
        if (isManuallyNew) {
            editableNode = $bar;
            showEventSettings($bar);
            $element.find(SELECTORS.eventTitleInput).focus();
        }

        let isAvailableToModify = settings.showTimeMark ? positionFromLeft >= currentTimeLeftBorder : true;
        if (isAvailableToModify) {
            this.makeNodeDraggable($bar);
            this.makeNodeResizable($bar);
        } else {
            $bar.addClass('past-event');
        }

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
     * @param [eventData] {event} Event Data
     * @param [isDisabled] {boolean} Is buttons disabled ?
     */
    function showEventSettings($bar, eventData = {}, isDisabled = false) {

        editableNode = $bar;
        let defaultOpts = webuiPopoverConfGetter($element.get(0), {
            hideFn() {
                $lastEditedBar = $bar;
                $bar.removeClass('in-edit');
                $bar.webuiPopover('destroy');
                $element.find('.sc_bar.previous-group').removeClass('previous-group');
                removeSameClass();
            },
            showFn() {
                if($lastEditedBar) {
                    $lastEditedBar.addClass('previous-group');
                }
            },
            closeBtn: isDisabled
        });

        const options = $.extend({},
            defaultOpts, {
                content: webUIPopoverTemplateFn({
                    fields: eventFields,
                    disabled: isDisabled
                })
            });

        WebuiPopovers.show($bar.get(0), options);

        $element.find(SELECTORS.eventTitleInput).val(eventData.text);

        const $eventDataForm = $(SELECTORS.eventDataBlock);
        if (eventData.data) {
            const fieldNames = Object.keys(eventData.data);
            fieldNames.forEach(name => {
                $eventDataForm.find(`[name="${name}"]`).val(eventData.data[name]);
            });
        } else {
            $eventDataForm.find('[name]').val('');
        }

        $bar.addClass('in-edit');

        showSameGroup(eventData.groupId);
    }

    function showSameGroup(id) {
        const $bars = $element.find('.sc_bar');

        $bars.each((i, bar) => {
            const $bar = $(bar);
            const eventData = scheduleData[$bar.data('scKey')];
            if (eventData.groupId === id) {
                $bar.addClass('same-group');
            }
        });
    }


    function removeSameClass() {
        $element.find('.same-group').removeClass('same-group');
    }

    /**
     * Creates new event row
     * @param timeline
     * @param row
     */
    this.addRow = function (timeline, row) {
        let title = row["title"];
        let id = $element.find('.sc_main .timeline').length;

        let html;

        html = '';
        html += '<div class="timeline"><span>' + title + '</span></div>';
        let $data = $(html);
        // event call
        if (settings.init_data) {
            settings.init_data($data, row);
        }
        $element.find('.sc_data_scroll').append($data);

        html = '';
        html += '<div class="timeline"></div>';

        let $timeline = $(html);
        $timeline.data('timeline-number', id);

        for (let t = tableStartTime; t < tableEndTime; t += settings.widthTime) {
            let $tl = $('<div class="tl"></div>');
            $tl.width(settings.widthTimeX - settings.timeBorder);

            $tl.data("time", Utils.formatTime(t));
            $tl.data("timeline", timeline);
            $timeline.append($tl);
        }


        //
        // Timeline events
        //


        $timeline.on('mouseleave', () => {
            if ($tlMoveStartEl) {
                $tlMoveStartEl.trigger('mouseup');
                lastMovedTarget = null;
                $tlMoveStartEl = null;
            }
        });

        let $tlItem = $timeline.find(".tl");

        $tlItem
            .on('mousedown', function () {
                if (!$tlMoveStartEl) {
                    let $this = $(this);
                    // Hide all event popovers
                    WebuiPopovers.hideAll();

                    if (!$this.is('.create-disabled')) {
                        $tlMoveStartEl = $this;
                        $tlItem.removeClass('marked-for-new-event');
                        $tlMoveStartEl.addClass('marked-for-new-event');
                    }
                }
            })
            .on('mouseup', () => {
                if ($tlMoveStartEl) {
                    $tlMoveStartEl = null;

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
                    } else {
                        $tlMoveStartEl = null;
                        lastMovedTarget = null;
                    }
                }
            })
            .on('mousemove', function (e) { // mouse move while clicked right mouse btn
                if (e.buttons === 1 && lastMovedTarget !== e.target) {
                    let $this = $(this);

                    if (!$tlMoveStartEl || $this.is('.create-disabled')) {
                        return; //if user are resizing an event bar (bcuz it also mousedown + mousemove)
                    }

                    lastMovedTarget = e.target; // cuz it doesn't work with $this

                    let $elementsForSelect;
                    let elementPosition = Utils.docPosition($this, $tlMoveStartEl);

                    if (elementPosition === 'before') {
                        $elementsForSelect = $tlMoveStartEl.nextUntil($this);
                    } else if (elementPosition === 'after') {
                        $elementsForSelect = $tlMoveStartEl.prevUntil($this);
                    }

                    if ($elementsForSelect) {
                        $tlItem.removeClass('marked-for-new-event');
                        $elementsForSelect.addClass('marked-for-new-event');
                    }
                    $tlMoveStartEl.addClass('marked-for-new-event');
                    $this.addClass('marked-for-new-event');
                } else if (e.buttons === 0) {
                    if ($tlMoveStartEl) {
                        $tlMoveStartEl = null;
                        lastMovedTarget = null;
                        $tlItem.removeClass('marked-for-new-event');
                    }
                }
            });

        // click event
        if (settings.time_click) {
            $tlItem.on('click', function () { // regular click
                settings.time_click(this, $(this).data("time"), $(this).data("timeline"), timelineData[$(this).data("timeline")]);
            });
        }


        $element.find('.sc_main').append($timeline);

        timelineData[timeline] = row;

        if (row["class"] && (row["class"] !== "")) {
            $element.find('.sc_data .timeline').eq(id).addClass(row["class"]);
            $element.find('.sc_main .timeline').eq(id).addClass(row["class"]);
        }

        // Schedule timeline
        if (row["schedule"]) {
            for (let event in row.schedule) {
                if (row.schedule.hasOwnProperty(event)) {

                    let bdata = row["schedule"][event];
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
                    if (row.id) {
                        data.row_id = row.id;
                    }
                    if(bdata.id) {
                        data.id = bdata.id;
                    }
                    element.addScheduleData(data);
                }
            }
        }

        // Adjust height
        element.resetBarPosition(id);
        $element.find('.sc_main .timeline').eq(id).droppable({
            accept: ".sc_bar",
            drop: function (ev, ui) {
                let node = ui.draggable;
                let scKey = node.data("scKey");
                let nowTimelineNum = scheduleData[scKey]["timeline"];
                let timelineNum = $element.find('.sc_main .timeline').index(this);
                // change timeline
                scheduleData[scKey]["timeline"] = timelineNum;
                node.appendTo(this);
                // Height adjustment
                element.resetBarPosition(nowTimelineNum);
                element.resetBarPosition(timelineNum);
            }
        });

        // Call back if callback is set
        if (settings.append) {
            $element.find('.sc_main .timeline').eq(id).find(".sc_bar").each(function () {
                let node = $(this);
                let scKey = node.data("scKey");
                settings.append(node, scheduleData[scKey]);
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

    /**
     * Update event's text
     * @param node
     * @param data
     */
    this.rewriteBarText = function (node, data) {
        let x = node.position().left;
        let w = node.width();
        let start = tableStartTime + (Math.floor(x / settings.widthTimeX) * settings.widthTime);
        //let end = tableStartTime + (Math.floor((x + w) / settings.widthTimeX) * settings.widthTime);
        let end = start + (data["end"] - data["start"]);
        let html = Utils.formatTime(start) + " - " + Utils.formatTime(end);
        $(node).find(".time").html(html);
    };


    /**
     * Re-positioning event bars positions after anything was changed
     * Kind of magic code here
     * @param n
     */
    this.resetBarPosition = function (n) {
        let self = this;
        // reorder elements
        let $bar_list = $element.find('.sc_main .timeline').eq(n).find(".sc_bar");
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


        // Messy code :-[
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
                } else {
                    if (settings.seriesEvents) {
                        let delta = 0;

                        // Calculate delta to avoid box overflow
                        if ($e1.width() + e2 + settings.resizeBorderWidth > $e1.parent().width()) {
                            delta = $e1.parent().width() - $e1.width() - settings.resizeBorderWidth - e2 - settings.resizeBorderWidth;
                            console.log(delta);
                        }

                        // Right bar
                        $e1.css({left: e2 + settings.resizeBorderWidth + (delta ? delta : 0)});
                        let time = self.getBarTime($e1);
                        self.rewriteBarText($e1, {start: time.startTime, end: time.endTime});

                        if (delta) {
                            // Left bar
                            $e2.css({left: $e2.position().left + delta});
                            let time = self.getBarTime($e2);
                            self.rewriteBarText($e2, {start: time.startTime, end: time.endTime});
                        }
                    }
                }
            }
            if (!check[h]) {
                check[h] = [];
            }
            if (settings.seriesEvents) {
                h = 0;
            }
            $e1.css({top: ((h * settings.timeLineY) + settings.timeLinePaddingTop)});
            check[h][check[h].length] = c1;
        }
        // Adjust height
        this.resizeRow(n, check.length);
    };


    this.resizeRow = function (n, height) {
        let h = settings.seriesEvents ? 1 : Math.max(height, 1);
        $element.find('.sc_data .timeline').eq(n).height((h * settings.timeLineY) - settings.timeLineBorder + settings.timeLinePaddingTop + settings.timeLinePaddingBottom);
        $element.find('.sc_main .timeline').eq(n).height((h * settings.timeLineY) - settings.timeLineBorder + settings.timeLinePaddingTop + settings.timeLinePaddingBottom);

        $element.find('.sc_main .timeline').eq(n).find(".sc_bgBar").each(function () {
            $(this).height($(this).closest(".timeline").height());
        });

        $element.find(".sc_data").height($element.find(".sc_main_box").height());
    };


    // resizeWindow
    this.resizeWindow = function () {
        let sc_width = $element.width();
        let sc_main_width = sc_width - settings.dataWidth - (settings.verticalScrollbar);
        let cell_num = Math.floor((tableEndTime - tableStartTime) / settings.widthTime);
        $element.find(".sc_header_cell").width(settings.dataWidth);
        $element.find(".sc_data,.sc_data_scroll").width(settings.dataWidth);
        $element.find(".sc_header").width(sc_main_width);
        $element.find(".sc_main_box").width(sc_main_width);
        $element.find(".sc_header_scroll").width(settings.widthTimeX * cell_num);
        $element.find(".sc_main_scroll").width(settings.widthTimeX * cell_num);

    };

    /**
     * Start point
     */
    this.init = function () {
        console.time('Init');

        if (settings.showTimeMark) {
            this.calcCurrentTime();
        }
        this.renderData();
        if (settings.showTimeMark) {
            this.showCurrentTimeProgress();
        }

        this.changeEventHandler();
        console.timeEnd('Init');
    };

    this.renderData = function () {
        $element.append(tableLayoutHTML);

        $element.find(".sc_main_box").scroll(function () {
            $element.find(".sc_data_scroll").css("top", $(this).scrollTop() * -1);
            $element.find(".sc_header_scroll").css("left", $(this).scrollLeft() * -1);
        });

        // add time cell
        let cell_num = Math.floor((tableEndTime - tableStartTime) / settings.widthTime);
        let before_time = -1;
        for (let t = tableStartTime; t < tableEndTime; t += settings.widthTime) {

            if (
                (before_time < 0) ||
                (Math.floor(before_time / 3600) !== Math.floor(t / 3600))) {

                let $time = $(tableHeaderHTML.replace('{{formatTime}}', Utils.formatTime(t)));
                let cell_num = Math.floor(Number(Math.min((Math.ceil((t + settings.widthTime) / 3600) * 3600), tableEndTime) - t) / settings.widthTime);
                $time.width((cell_num * settings.widthTimeX) - settings.headTimeBorder);
                $element.find(".sc_header_scroll").append($time);

                before_time = t;
            }
        }

        $(window).resize(function () {
            element.resizeWindow();
        }).trigger("resize");

        // Add rows
        settings.rows.forEach(function (val, i) {
            this.addRow(i, val);
        }.bind(this));
    };


    this.makeBarPastEvent = $bar => {
        $bar.addClass('past-event')
            .draggable('destroy')
            .resizable('destroy')
            .off('submit', SELECTORS.eventChangeForm);
    };

    /*
     Click on save/submit button
     */
    this.changeEventHandler = () => {
        const self = this;

        $element.on('submit', SELECTORS.eventChangeForm, function (e) {
            e.preventDefault();

            if (editableNode) {
                let dataToSave = Utils.serializeObject($(this));
                let scKey = editableNode.data("scKey");
                let eventData = scheduleData[scKey];
                if (!eventData) {
                    throw new Error('Editable event not found');
                }
                eventData.text = dataToSave.title;
                delete(dataToSave['title']);
                eventData.data = Object.assign({}, dataToSave);

                // Update memory data
                scheduleData[scKey] = eventData;

                // Generate HTML with updated data
                eventData.data = eventData.data || {};
                const newDataHTML = self.generateBarDataHTML(eventData);
                // Update UI data
                editableNode.find('.event-bar-data').html(newDataHTML);

                // Hide event settings
                editableNode.webuiPopover('destroy');

                editableNode.removeData('originalLeft');
                editableNode.removeData('originalTimeline');
                editableNode.removeData('originalGroupId');

                if (editableNode.position().left <= currentTimeMarkLeft && settings.showTimeMark) {
                    self.makeBarPastEvent(editableNode);
                }

                editableNode = null;

                // Callback on change
                if (settings.onChange) {
                    settings.onChange(scheduleData);
                }
            } else {
                throw new Error('Editable node not specified');
            }
        });


        /*
         Delete button click
         */
        $element.on('click', SELECTORS.eventDeleteBtn, () => {
            let scKey = editableNode.data("scKey");
            delete(scheduleData[scKey]); // delete will save keys

            // Hide settings popover
            editableNode.webuiPopover('destroy');

            // Delete from UI
            editableNode.off();
            editableNode.remove();

            editableNode = null;

            // Callback on change
            if (settings.onChange) {
                settings.onChange(scheduleData);
            }
        });

        /*
         Cancel button click
         */
        $element.on('click', SELECTORS.eventCancelBtn, (e) => {
            e.preventDefault();

            const scKey = editableNode.data("scKey");
            const currentTimelineEl = editableNode.closest('.timeline.ui-droppable');
            const currentTimelineIndex = currentTimelineEl.index();

            const originalLeft = editableNode.data('originalLeft');
            if (typeof originalLeft !== 'undefined') {
                editableNode.css({
                    left: originalLeft
                });
            }

            const originalWidth = editableNode.data('originalWidth');
            if (typeof originalWidth !== 'undefined') {
                editableNode.css({
                    width: originalWidth
                });
            }

            const originalTimeline = editableNode.data('originalTimeline');
            if (typeof originalTimeline !== 'undefined' && originalTimeline !== currentTimelineIndex) {
                let originalTimelineEl = $element.find('.timeline.ui-droppable').eq(originalTimeline);
                originalTimelineEl.append(editableNode);
                removeSameClass();
            }

            const originalGroupId = editableNode.data('originalGroupId');
            if (typeof originalGroupId !== 'undefined') {
                scheduleData[scKey]['groupId'] = originalGroupId;
            }

            editableNode.removeData('originalLeft');
            editableNode.removeData('originalTimeline');
            editableNode.removeData('originalWidth');
            editableNode.removeData('originalGroupId');


            let barTime = this.getBarTime(editableNode);

            scheduleData[scKey]["start"] = barTime.startTime;
            scheduleData[scKey]["end"] = barTime.endTime;

            element.rewriteBarText(editableNode, scheduleData[scKey]);

            editableNode.webuiPopover('destroy');

            editableNode = null;

            return false;
        });


        /*
         Group button click
         */
        $element.on('click', SELECTORS.eventGroupBtn, (e) => {
            e.preventDefault();

            if (!$lastEditedBar) {
                return;
            }

            const lastEditedBarScKey = $lastEditedBar.data("scKey");
            const lastBarData = scheduleData[lastEditedBarScKey];
            const scKey = editableNode.data("scKey");
            const editableNodeData = scheduleData[scKey];

            editableNode.data('originalGroupId', editableNodeData.groupId); //save original group ID in case of canceling

            const newGroupId = lastBarData.groupId;
            editableNodeData.groupId = newGroupId;

            showSameGroup(newGroupId);

            const $eventDataForm = $(SELECTORS.eventDataBlock);
            if (lastBarData.data) {
                const fieldNames = Object.keys(lastBarData.data);
                fieldNames.forEach(name => {
                    $eventDataForm.find(`[name="${name}"]`).val(lastBarData.data[name]);
                });
            } else {
                $eventDataForm.find('[name]').val('');
            }

            $lastEditedBar.addClass('same-group');

            return false;
        });
    };

    this.updateEvents = function () {
        const $bars = $element.find('.sc_bar');

        $bars.each((i, bar) => {
            const $bar = $(bar);
            if (currentTimeMarkLeft >= $bar.position().left && !$bar.is('.past-event, .in-edit, .ui-draggable-dragging')) {
                this.makeBarPastEvent($bar);
            }
        });
    };


    this.showCurrentTimeMark = function () {
        let $timeTable = $element.find('.sc_main');
        $timeTable.find('.current-time-mark').remove();

        if (currentTimeMarkLeft !== null && currentTimeMarkLeft <= $timeTable.width()) {
            $timeTable.append('<div class="current-time-mark"></div>');
            let $mark = $timeTable.find('.current-time-mark');
            $mark.css({left: currentTimeMarkLeft});
        }


    };

    this.calcCurrentTime = function () {
        let date = new Date();
        let hours = date.getHours();
        let minutes = date.getMinutes();

        if (settings.demoMode) {
            settings.debugTime = Utils.debugCalcStringTime();
        }

        if (typeof settings.debugTime === 'string') {
            let split = settings.debugTime.split(':');
            hours = split[0];
            minutes = split[1];
        }

        currentTime = Utils.calcStringTime(`${hours}:${minutes - minutes % 10}`);

        let startHour = +settings.startTime.split(':')[0];

        fullRowsCount = hours - startHour;
        if (fullRowsCount >= 0) {
            fullCellsCount = fullRowsCount * 6 + (minutes - minutes % 10) / 10; // one time row contains 6 time cells
            minutePercentage = minutes / 60 * 100;

            currentTimeLeftBorder = fullCellsCount * this.settings.widthTimeX;
            currentTimeMarkLeft = fullRowsCount * 150 + (minutePercentage / 100) * 150; // weird math
        } else {
            fullCellsCount = 0;
            minutePercentage = 0;
            currentTimeLeftBorder = 0;
            currentTimeMarkLeft = null;

            //TODO mark all rest timeline like disabled
        }
    };

    this.showCurrentTimeProgress = function () {
        let $rows = $element.find('.sc_time');
        for (let i = 0; i < fullRowsCount; i++) {
            $rows.eq(i).addClass('past-time')
        }

        $rows
            .eq(fullRowsCount)
            .append('<div class="minutes-percentage"></div>')
            .find('.minutes-percentage')
            .width(`${minutePercentage}%`);

        let $timeLines = $element.find('.timeline.ui-droppable');
        $timeLines.each(function () {
            let $timeCells = $(this).find('.tl');

            for (let i = 0; i < fullCellsCount; i++) {
                $timeCells.eq(i).removeClass('created-warning').addClass('create-disabled');
            }

            if (Math.round(minutePercentage * 60) % 1000) {
                $timeCells.eq(fullCellsCount).addClass('created-warning');
            }
        });

        this.showCurrentTimeMark();

        setTimeout(() => {
            console.time('Cycle');
            this.calcCurrentTime();
            this.showCurrentTimeProgress();
            this.updateEvents();
            console.timeEnd('Cycle');
        }, 3000); // TODO DEBUG
    };

    // Initialization
    this.init();

    this.debug = function () {
        const $debug = typeof settings.debugContainer === 'string' ? $(settings.debugContainer) : settings.debugContainer;
        let html = '';
        for (let i in scheduleData) {
            let propsString = Object.keys(scheduleData[i]).map(k => `${k}: ${JSON.stringify(scheduleData[i][k])} `).join(' ');
            html += `<div style="font-size: smaller">[${i}] ${propsString}</div>`;
        }
        $debug.html(html);
    };
    if (settings.debugContainer && settings.debugContainer !== "") {
        setInterval(function () {
            element.debug();
        }, 500);
    }

    return (this);
};
