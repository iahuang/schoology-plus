"use strict";

let feedBody = document.getElementsByClassName("s-edge-feed")[0];

// UTIL

function whenElementAppears(jqSelector, cb, delay = 500) {
    let interval = setInterval(() => {
        let el = $(jqSelector);
        if (el.length) {
            cb(el);
            clearInterval(interval);
        }
    }, delay);
}

function scrollDistanceFromBottom() {
    let scrollBottom = document.body.clientHeight - window.innerHeight;
    return scrollBottom - window.scrollY;
}

var s = document.createElement("script");
s.src = chrome.extension.getURL("background.js");
(document.head || document.documentElement).appendChild(s);

let schoologySecureAjax = function (params) {
    let ev = new CustomEvent("secureAjax", { detail: JSON.stringify(params) });
    document.dispatchEvent(ev);
};

// MAIN

const settings = {
    blocked: ["NSHS Library", "Tori Parker"]
};

function markupTextNode() {
    // console.log(this, $(this).children());

    let el = $(this);

    if (el.prop("style")) {
        el.removeAttr("style");
    }

    if (el.children().length) {
        return;
    }

    if (el.text().trim() === "") {
        el.remove();
        return;
    }

    let htmlContent = el.html();

    // replace unlinked links with links
    if (el.prop("tagName") !== "a") {
        for (let url of htmlContent.match(urlPattern) || []) {
            htmlContent = htmlContent.replace(
                url,
                `<a href="${url}">${url}</a>`
            );
        }
    }

    // highlight days in update posts
    for (let day of htmlContent.match(
        /\b((mon|tues|wed(nes)?|thur(s)?|fri|sat(ur)?|sun)(day)?)s?\b/gi
    ) || []) {
        htmlContent = htmlContent.replace(
            day,
            `<span class="day">${day}</span>`
        );
    }

    // unstyle

    el.html(htmlContent);
}

class FeedPost {
    constructor(domElement) {
        this.author = $(domElement)
            .find(".update-sentence-inner")
            .children()
            .first()
            .text();

        let courseLabel = $(domElement)
            .find(".update-sentence-inner")
            .children()
            .eq(2);
        this.courseName = courseLabel.text();

        courseLabel.text(
            this.courseName
                .replace(/NSHS,? ?/gi, "")
                .replace(/ ?\(?\d{4} ?- ?(\d+)\)?/gi, "")
        );

        this.element = $(domElement);
        this.updateContent = this.element.find(".update-body");
        this.updateText = this.updateContent.text();

        this.updateContent.find("*").each(markupTextNode);
    }
}

function nextPage() {
    let moreButton = $(".sEdgeMore-processed");
    if (moreButton.length) {
        moreButton[0].click();

        setTimeout(
            whenElementAppears(".sEdgeMore-processed", () => {
                onFeedRefresh();
            }),
            500
        );
    }
}

let overdueHidden = false;
function hideOverdueFunction() {
    whenElementAppears(".upcoming-list", () => {
        let sidebar = $(".overdue-submissions");
        let items = sidebar.find(".upcoming-list");
        sidebar
            .children()
            .first()
            .text(`Overdue (${sidebar.find(".course-event").length})`);
        sidebar
            .children()
            .first()
            .append(
                hyperlink("Show/Hide")
                    .href("#")
                    .onClick(() => {
                        items.toggle();
                    })
                    .render()
            );
        items.toggle();
        // the due date times underneath assignemnts (who tf looks at those?)
        sidebar.find(".upcoming-time").remove();
    });
}

function cleanUpLayout() {
    // straight up remove some features on the page that literally nobody uses or will ever use
    $(`button[aria-label="Show Apps"]`).hide();

    // the little schoology icon at the bottom-right of your screen
    whenElementAppears(
        "._pendo-launcher-badge_",
        () => {
            $("._pendo-launcher_").remove();
            $("._pendo-launcher-badge_").remove();
        },
        100
    );

    // $(".sgy-tabbed-navigation").empty();

    // the "resources button"
    $(`a[href="/resources"]`).remove();
}

function init() {
    document.addEventListener("scroll", () => {
        if (scrollDistanceFromBottom() < 100) {
            nextPage();
        }
    });

    $(document).click(function(e) {
        setTimeout(onFeedRefresh, 500);
    });

    setInterval(() => {
        let moreButton = $(".sEdgeMore-processed");
        if (moreButton.length) {
            if (document.body.clientHeight - moreButton.offset().top > 500) {
                nextPage();
            }
        }
    }, 1000);

    hideOverdueFunction();
    cleanUpLayout();

    // setTimeout(() => {
    //     setInterval(() => {
    //         onFeedRefresh();
    //     }, settings.feedModifierRefreshRate);
    // }, 1000);
}

let likeData = [];

class LikeWidget extends Component {
    constructor(likes, hasLiked, id, likeAjax) {
        super();
        this.likes = likes;
        this.hasLiked = hasLiked;
        this.id = id;
        this.likeAjax = likeAjax;
    }

    body() {
        return span(
            image(
                chrome.runtime.getURL(
                    this.hasLiked ? "assets/liked.png" : "assets/like.png"
                )
            )
                .class("like-icon")
                .onClick(() => {
                    schoologySecureAjax({
                        url: this.likeAjax,
                        dataType: "json",
                        async: false,
                    });
                    this.hasLiked = !this.hasLiked;
                    htmless.rerender(this);
                }),
            this.likes + this.hasLiked
        ).class("likes-text");
    }
}

function randomPfpFromName(name) {
    let seed = name.hashCode();

    let url = [0, 1, 2, 3, 4]
        .map((i) => "assets/pfp" + i + ".png")
        .seededRandom(seed);

    return url;
}

let moreButton;

function onFeedRefresh() {
    console.log("Feed refresh")
    // Replace like buttons
    $(".like-btn").each(function () {
        let likeButton = $(this);

        let id = this.id.match(/\d+/g)[0];
        let type = this.id.match(/(?<=-)c|n(?=-)/g)[0];
        if (type === "n") {
            // Schoology post
            let likeSentence = likeButton.parent().find(".s-like-sentence");
            let numLikes = 0;
            let hasLiked = false;

            if (likeSentence.length) {
                let otherLikes = likeSentence.text().match(/\d/g);
                if (otherLikes) {
                    numLikes = parseInt(otherLikes[0]);
                }

                if (likeSentence.text().includes("You")) {
                    hasLiked = true;
                }
                likeSentence.remove();
            }

            let likeAjax = likeButton.attr("ajax");
            let component = new LikeWidget(numLikes, hasLiked, id, likeAjax);
            likeData.push(component);
            likeButton.replaceWith(span(component).render());
        }
    });

    // Hide posts from blocked users
    let numRemoved = 0;
    for (let post of getFeedPosts()) {
        if (settings.blocked.includes(post.author)) {
            post.element.remove();
            numRemoved++;
        }
    }
    //console.log("Removed", numRemoved, "posts");

    // Replace default profile pictures

    $(".profile-picture").each(function () {
        let pfp = $(this).children().first();

        let isDefaultPfp = pfp
            .attr("src")
            .match(/(profile_sm\?0)|(user-default.gif)/g);

        if (true) {
            let pfpSeed = pfp.attr("alt");
            let newPfp = randomPfpFromName(pfpSeed);
            pfp.attr("src", chrome.runtime.getURL(newPfp));
        }
    });
}

function getFeedPosts() {
    return Array.from(feedBody.children)
        .filter((el) => el.id.match(/edge-assoc/g))
        .map((el) => new FeedPost(el));
}

whenElementAppears(
    ".sEdgeMore-processed",
    () => {
        console.log("Ready");
        init();
        onFeedRefresh();
    },
    100
);
