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

function whenElementDisappears(domElement, cb, delay = 100) {
    let interval = setInterval(() => {
        if (!document.body.contains(domElement)) {
            clearInterval(interval);
            cb();
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
    blocked: ["NSHS Library", "Tori Parker"],
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

    // if (el.text().trim() === "") {
    //     el.remove();
    //     return;
    // }

    let htmlContent = el.html();

    // replace unlinked links with links
    if (el.prop("tagName") !== "a") {
        for (let url of htmlContent.match(urlPattern) || []) {
            htmlContent = htmlContent.replace(
                url,
                `<a href="${url}">${url}</a>`
            );
        }

        htmlContent = htmlContent.replace(
            /\baspen\b/gi,
            `<a href="https://aspen.newton.k12.ma.us/">Aspen</a>`
        );
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
                onFeedRefresh("Next page loaded");
                clickShowMore();
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

    // if the more button is too far away from the bottom just click it idk

    // setInterval(() => {
    //     let moreButton = $(".sEdgeMore-processed");
    //     if (moreButton.length) {
    //         if (document.body.clientHeight - moreButton.offset().top > 500) {
    //             nextPage();
    //         }
    //     }
    // }, 1000);

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

    let url = [0, 1, 2, 3, 4, 5]
        .map((i) => "assets/pfp" + i + ".png")
        .seededRandom(seed);

    return url;
}

let moreButton;

function requestFullUpdate(apiLink, batchData) {
    fetch(apiLink)
        .then((response) => {
            batchData.hasResolved++;
            if (!response.ok) {
                // error handling

                if (response.status === 429) {
                    // too many requests / rate limited

                    batchData.halted = true; // batch should stop
                } else {
                    // something else went wrong

                    console.log(
                        "An unknown error occurred trying to expand post"
                    );
                }

                return; // don't try to parse json
            }
            return response.json();
        })
        .then((data) => {
            let batchResolved =
                batchData.hasResolved == batchData.numExpandPending;

            if (batchData.halted && !batchData.haltCalled) {
                // dammit one of the fetches returned an error and
                // nobody has let the caller function know!
                if (batchResolved) {
                    // also we should make sure the rest of the fetches have completed too (fail or not)
                    batchData.on.halt(batchData);
                    batchData.haltCalled = true;
                }
            }

            if (!data) {
                return;
            }
            // if no error was returned:

            // only remove the "show more" button if the post is actually not that long
            $(this).parent().find(".update-body").html(data.update);
            $(this).remove();

            batchData.hasExpanded++;
            if (batchData.hasExpanded == batchData.numExpandPending) {
                // batch is done!
                batchData.on.complete(batchData);
            }
        });
}

function clickShowMore() {
    // when we load the next page, we get a bunch of posts that need to be "read more"'d
    // the posts also need to be formatted through onFeedRefresh, but for optimization
    // we should only do that once all posts have been completed

    let showMoreBatchData = {
        numExpandPending: $(".show-more-link").length,
        hasResolved: 0, // number of requests that have completed, error or not
        hasExpanded: 0, // number of requests that have completed successfully
        halted: false, // halt batch if we get rate limited
        haltCalled: false, // have we called this.on.halt yet?
        on: {
            halt: function (batchData) {
                // something bad happened

                if (batchData.hasExpanded > 0) {
                    // if some posts were successfully expanded before an error occurred
                    // we still need to update those
                    onFeedRefresh("Auto-expanded show more (incomplete!)");
                }
                
                // try again in a bit
                setTimeout(() => {
                    console.log("retrying...")
                    clickShowMore();
                }, 2000);
            },
            complete: function (batchData) {
                // Only refresh the feed when all the posts have been expanded
                onFeedRefresh("Auto-expanded show more");
            },
        },
    };

    $(".show-more-link").each(function () {
        let apiLink = $(this).prop("href");
        requestFullUpdate(apiLink, showMoreBatchData);
    });
}

function onFeedRefresh(reason = "none") {
    console.log("Feed refresh:", reason);
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

    // Remove file size labels

    $(".attachments-file-size").remove();
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
        onFeedRefresh("Initial feed refresh");
        clickShowMore();
    },
    100
);
