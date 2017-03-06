import * as Utils from './utils';
import 'script-loader!./jquery.webui-popover.min.js';
import webuiPopoverConfGetter from './webui-popover-conf';
import SELECTORS from './selectors';

const tableLayoutHTML = require('./templates/table-layout.ejs')();
const tableHeaderHTML = require('./templates/table-header.ejs')();

require('./scss/main.scss');


const webUIPopoverTemplateFn = require('./templates/webui-popover.ejs');

$.fn.timeSchedule = function (options) {
    const defaults = {
        rows: {},
        startTime: "10:00",
        endTime: "18:00",
        widthTimeX: 25,		// Width per cell (px)
        widthTime: 600,		// Separation time (sec)
        timeLineY: 55,		// timeline height(px)
        timeLineBorder: 4,	// timeline height border
        timeBorder: 1,		// border width
        timeLinePaddingTop: 0,
        timeLinePaddingBottom: 3,
        headTimeBorder: 0,	// time border width
        dataWidth: 160,		// data width
        verticalScrollbar: 20,	// vertical scrollbar width
        resizeBorderWidth: 4, // Resize border width
        seriesEvents: true, // allow few events in one row

        // event
        init_data: null,
        change: null,
        click: null,
        append: null,
        time_click: null,
        debug: ""			// debug selector
    };

    let setting = $.extend(defaults, options);
    this.settings = setting;
    let scheduleData = [];
    let timelineData = [];
    const $element = $(this);
    const element = (this);
    let tableStartTime = Utils.calcStringTime(setting.startTime);
    let tableEndTime = Utils.calcStringTime(setting.endTime);
    const eventFields = setting.fields || [];
    let currentNode = null;
    let editableNode = null;
    let currentTime = null;
    let currentTimeLeftBorder = null;
    let currentTimeMarkLeft = null; // TODO rename
    let fullRowsCount = null;
    let fullCellsCount = null;
    let minutePercentage = null;

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

    this.getBarTime = function ($bar) {
        let sc_key = $bar.data('sc_key');
        let x = $bar.position().left;
        let w = $bar.width();
        let startTime = tableStartTime + (Math.floor(x / setting.widthTimeX) * setting.widthTime);
        let endTime = tableStartTime + (Math.floor((x + w) / setting.widthTimeX) * setting.widthTime) + setting.widthTime;

        return {startTime, endTime};
    };

    this.isEventCanBeMoved = function ($bar) {
        let startTime = this.getBarTime($bar).startTime;
        return startTime > currentTime;
    };

    this.makeNodeDraggable = function ($node) {
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

                let sc_key = $moveNode.data("sc_key");
                let timelineNum = element.getTimeLineNumber(ui.offset.top);


                // Uncomment if you want to get hard fixed position
                // ui.position.top = Math.floor(ui.position.top / setting.timeLineY) * setting.timeLineY;

                ui.position.left = Math.floor(ui.position.left / setting.widthTimeX) * setting.widthTimeX;

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
                element.rewriteBarText($moveNode, scheduleData[sc_key]);

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

                let sc_key = $node.data("sc_key");
                let x = $node.position().left;

                let start = tableStartTime + (Math.floor(x / setting.widthTimeX) * setting.widthTime);
                let end = start + ((scheduleData[sc_key]["end"] - scheduleData[sc_key]["start"]));

                showEventSettings($node, scheduleData[sc_key]);

                scheduleData[sc_key]["start"] = start;
                scheduleData[sc_key]["end"] = end;
                // Call back if callback is set
                if (setting.change) {
                    setting.change($node, scheduleData[sc_key]);
                }
            }
        });
    };

    this.makeNodeResizable = function ($node) {
        let self = this;
        $node.resizable({
            handles: 'e', // East (right) and West (left),
            grid: [setting.widthTimeX, setting.timeLineY],
            minWidth: setting.widthTimeX,
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

                let sc_key = $node.data("sc_key");
                let time = self.getBarTime($node);
                let timelineNum = scheduleData[sc_key]["timeline"];

                scheduleData[sc_key]["start"] = time.startTime;
                scheduleData[sc_key]["end"] = time.endTime;

                // Height adjustment
                element.resetBarPosition(timelineNum);
                // Text change
                element.rewriteBarText($node, scheduleData[sc_key]);

                $node.data("resizeCheck", false);

                $node.data({
                    originalWidth: ui.originalSize.width
                });

                showEventSettings($node, scheduleData[sc_key]);

                // Call back if callback is set
                if (setting.change) {
                    setting.change($node, scheduleData[sc_key]);
                }
            }
        });
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
        let $bar = $('<div class="sc_bar"><span class="head"><span class="time"></span></span><span class="text"></span></div>');
        let stext = Utils.formatTime(data["start"]);
        let etext = Utils.formatTime(data["end"]);
        let snum = data["timeline"];
        let positionFromLeft = st * setting.widthTimeX;
        $bar.css({
            left: positionFromLeft,
            top: 0, //((snum * setting.timeLineY) + setting.timeLinePaddingTop), // это влияет на отступ блока внутри собственного таймлайна. тупо что он отличный был от нуля
            width: ((et - st) * setting.widthTimeX - setting.resizeBorderWidth), //
            height: (setting.timeLineY)
        });
        $bar.find(".time").text(stext + " - " + etext);
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
        $bar.data('sc_key', key);


        $bar.on('mouseup', function() { // 'function' bcuz we need 'this'
            let $this = $(this);

            if ($this.data('dragCheck') !== true && $(this).data('resizeCheck') !== true) {
                let sc_key = $this.data('sc_key');
                let eventData = scheduleData[sc_key];

                // Show this event settings
                showEventSettings($this, eventData, positionFromLeft < currentTimeLeftBorder);

                // Run 'click' callback if it was set
                if (typeof setting.click === 'function') {
                    setting.click($this, eventData);
                }
            }
        });

        $bar.on('mousemove', () => {
            // if($tlMoveStartEl) {
            //     $tlMoveStartEl.trigger('mouseup');
            //     $tlMoveStartEl = null;
            // }
        });

        // Set event popover with it's settings
        if (isManuallyNew) {
            editableNode = $bar;

            showEventSettings($bar);

            $element
                .find(SELECTORS.eventTitleInput)
                .focus();
        }

        // let isAvailableToModify = $bar.position().left >= currentTimeMarkLeft;
        let isAvailableToModify = positionFromLeft >= currentTimeLeftBorder;
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
        let defaultOpts = webuiPopoverConfGetter($element.get(0), hideFn => {
            $bar.removeClass('in-edit')
        });
        let options = $.extend({},
            defaultOpts, {
                content: webUIPopoverTemplateFn({
                    fields: eventFields,
                    disabled: isDisabled
                })
            });

        WebuiPopovers.show($bar.get(0), options);

        $element.find(SELECTORS.eventTitleInput).val(eventData.text);

        const $eventData = $(SELECTORS.eventDataBlock);
        if (eventData.data) {
            const fieldNames = Object.keys(eventData.data);
            fieldNames.forEach(name => {
                $eventData.find(`[name="${name}"]`).val(eventData.data[name]);
            });
        } else {
            $eventData.find('[name]').val('');
        }

        $bar.addClass('in-edit');
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

        let $tlItem = $timeline.find(".tl");
        let lastMovedTarget = null;
        let $tlMoveStartEl = null;

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
            });

        $tlItem.on('mousemove', function (e) { // mouse move while clicked right mouse btn
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
            accept: ".sc_bar",
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
            $element.find('.sc_main .timeline').eq(id).find(".sc_bar").each(function () {
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
        let html = Utils.formatTime(start) + " - " + Utils.formatTime(end);
        $(node).find(".time").html(html);
    };


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
                    if (setting.seriesEvents) {
                        let delta = 0;

                        // Calculate delta to avoid box overflow
                        if($e1.width() + e2 + setting.resizeBorderWidth > $e1.parent().width()) {
                            delta = $e1.parent().width() - $e1.width() - setting.resizeBorderWidth - e2 - setting.resizeBorderWidth;
                            console.log(delta);
                        }

                        // Right bar
                        $e1.css({left: e2 + setting.resizeBorderWidth + (delta ? delta : 0)});
                        let time = self.getBarTime($e1);
                        self.rewriteBarText($e1, {start: time.startTime, end: time.endTime});

                        if(delta) {
                            // Left bar
                            $e2.css({left: $e2.position().left + delta });
                            let time = self.getBarTime($e2);
                            self.rewriteBarText($e2, {start: time.startTime, end: time.endTime});
                        }
                    }
                }
            }
            if (!check[h]) {
                check[h] = [];
            }
            if (setting.seriesEvents) {
                h = 0;
            }
            $e1.css({top: ((h * setting.timeLineY) + setting.timeLinePaddingTop)});
            check[h][check[h].length] = c1;
        }
        // Adjust height
        this.resizeRow(n, check.length);
    };
    this.resizeRow = function (n, height) {
        let h = setting.seriesEvents ? 1 : Math.max(height, 1);
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
        console.time('Init');
        this.calcCurrentTime();
        this.renderData();
        this.showCurrentTimeProgress();

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
        let cell_num = Math.floor((tableEndTime - tableStartTime) / setting.widthTime);
        let before_time = -1;
        for (let t = tableStartTime; t < tableEndTime; t += setting.widthTime) {

            if (
                (before_time < 0) ||
                (Math.floor(before_time / 3600) != Math.floor(t / 3600))) {

                let $time = $(tableHeaderHTML.replace('{{formatTime}}', Utils.formatTime(t)));
                let cell_num = Math.floor(Number(Math.min((Math.ceil((t + setting.widthTime) / 3600) * 3600), tableEndTime) - t) / setting.widthTime);
                $time.width((cell_num * setting.widthTimeX) - setting.headTimeBorder);
                $element.find(".sc_header_scroll").append($time);

                before_time = t;
            }
        }

        $(window).resize(function () {
            element.resizeWindow();
        }).trigger("resize");

        // Add rows
        setting.rows.forEach(function (val, i) {
            this.addRow(i, val);
        }.bind(this));
    };

    /*
     Click on save/submit button
     */
    this.changeEventHandler = () => {

        $element.on('submit', SELECTORS.eventChangeForm, function (e) {
            e.preventDefault();

            if (editableNode) {
                let dataToSave = Utils.serializeObject($(this)); // заголовок - поле title
                let sc_key = editableNode.data("sc_key");
                let eventData = scheduleData[sc_key];
                if (!eventData) {
                    throw new Error('Editable event not found');
                }
                eventData.text = dataToSave.title;
                delete(dataToSave['title']);
                eventData.data = Object.assign({}, dataToSave);

                // Update memory data
                scheduleData[sc_key] = eventData;

                // Update UI data
                editableNode.find('.text').text(eventData.text);

                // Hide event settings
                editableNode.webuiPopover('hide');

                editableNode.removeData('originalLeft');
                editableNode.removeData('originalTimeline');

                editableNode = null;
            } else {
                throw new Error('Editable node not specified');
            }
        });


        /*
         Delete button click
         */
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

        /*
         Cancel button click
         */
        $element.on('click', SELECTORS.eventCancelBtn, (e) => {
            e.preventDefault();

            let sc_key = editableNode.data("sc_key");
            let currentTimelineEl = editableNode.closest('.timeline.ui-droppable');
            let currentTimelineIndex = currentTimelineEl.index();

            let originalLeft = editableNode.data('originalLeft');
            if (typeof originalLeft !== 'undefined') {
                editableNode.css({
                    left: originalLeft
                });
            }

            let originalWidth = editableNode.data('originalWidth');
            if (typeof originalWidth !== 'undefined') {
                editableNode.css({
                    width: originalWidth
                });
            }

            let originalTimeline = editableNode.data('originalTimeline');
            if (typeof originalTimeline !== 'undefined' && originalTimeline !== currentTimelineIndex) {
                let originalTimelineEl = $element.find('.timeline.ui-droppable').eq(originalTimeline);
                originalTimelineEl.append(editableNode);
            }

            editableNode.removeData('originalLeft');
            editableNode.removeData('originalTimeline');
            editableNode.removeData('originalWidth');


            let barTime = this.getBarTime(editableNode);

            scheduleData[sc_key]["start"] = barTime.startTime;
            scheduleData[sc_key]["end"] = barTime.endTime;

            element.rewriteBarText(editableNode, scheduleData[sc_key]);

            editableNode.webuiPopover('hide');

            editableNode = null;

            return false;
        });
    };

    this.updateEvents = function () {
        const $bars = $element.find('.sc_bar');
        $bars.each((i, bar) => {
            const $bar = $(bar);
            if (currentTimeMarkLeft >= $bar.position().left) {
                $bar.addClass('past-event');
                // TODO remove drag and resize
            }
        });
    };


    this.showCurrentTimeMark = function () {
        let $timeTable = $element.find('.sc_main');
        $timeTable.find('.current-time-mark').remove();

        if (currentTimeMarkLeft !== null) {
            $timeTable.append('<div class="current-time-mark"></div>');
            let $mark = $timeTable.find('.current-time-mark');
            $mark.css({left: currentTimeMarkLeft});
        }

        //TODO не показывать дальше чем текущее время
    };

    this.calcCurrentTime = function () {
        let date = new Date();
        let hours = date.getHours();
        let minutes = date.getMinutes();

        // setting.debugTime = Utils.debugCalcStringTime(); //TODO DEBUG

        if (typeof setting.debugTime === 'string') {
            let split = setting.debugTime.split(':');
            hours = split[0];
            minutes = split[1];
        }

        currentTime = Utils.calcStringTime(`${hours}:${minutes - minutes % 10}`);

        let startHour = +setting.startTime.split(':')[0];

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
                $timeCells.eq(i).addClass('create-disabled');
            }
        });

        this.showCurrentTimeMark();

        setTimeout(() => {
            console.time('Cycle');
            this.calcCurrentTime();
            this.showCurrentTimeProgress();
            this.updateEvents();
            console.timeEnd('Cycle');
        }, 15000);
    };

    // Initialization
    this.init();

    this.debug = function () {
        let html = '';
        for (let i in scheduleData) {
            let propsString = Object.keys(scheduleData[i]).map(k => `${k}: ${JSON.stringify(scheduleData[i][k])} `).join(' ');
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
