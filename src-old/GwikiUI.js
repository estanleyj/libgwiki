GwikiUI = function(opts) {
    var t = this;
    Utils.merge(this, {
        defaultHome : false,
        home : null,
        doc : null,
        config : {
            prettyUrls : false
        }
    }, opts || {});

    // Sanity Check
    if (typeof this.root == 'undefined' || typeof this.root.appendChild == 'undefined') throw "You must provide a root ui element as part of the options hash when you construct a GwikiUI object (something like `new GwikiUI({ root: document.getElementById('gwiki-ui') })`)";

    // Load window.popstate listener for back/forward events
    // TODO: use state popped to update object state
    window.onpopstate = function(e) { t.updateState(); }

    // Make initial UI

    // Header
    this.root.appendChild(document.createElement('header'));
    this.header = this.root.lastChild;
    this.header.className = 'gwiki-header';

    // Title
    this.header.appendChild(document.createElement('h1'));
    this.siteTitle = this.header.lastChild;
    this.siteTitle.className = 'gwiki-site-title';
    this.siteTitle.addEventListener('click', function(e) {
        e.preventDefault();
        t.gwiki.setCurrentItem(e.target.gobject);
    });

    // Main navigation
    this.header.appendChild(document.createElement('nav'));
    this.mainMenuContainer = this.header.lastChild;
    this.mainMenuContainer.className = 'gwiki-main-menu';
    this.mainMenu = [];


    // Main Section
    this.root.appendChild(document.createElement('div'));
    this.root.lastChild.className = 'gwiki-main';

    // Sub navigation
    this.root.lastChild.appendChild(document.createElement('nav'));
    this.subMenuContainer = this.root.lastChild.lastChild;
    this.subMenuContainer.className = 'gwiki-sub-menu';
    this.subMenu = [];

    // Main content
    this.root.lastChild.appendChild(document.createElement('article'));
    this.mainContent = this.root.lastChild.lastChild;
    this.mainContent.className = 'gwiki-main-content';


    // Footer
    this.root.appendChild(document.createElement('footer'));
    this.footer = this.root.lastChild;
    this.footer.className = 'gwiki-footer';


    // After the interface is built, block until GwikiBridge is initialized
    this.loading(true);
}

GwikiUI.prototype = Object.create(Object.prototype);
GwikiUI.interface = ['block','askForHome','drawStandardInterface'];



















// Interface Functions

GwikiUI.prototype.init = function() {
    var home,doc,t=this;
    
    // Sanity check
    if (!Utils.implements(Gwiki.interface, this.gwiki)) throw "You must provide an instance of Gwiki as the argument to initialize a GwikiUI.";
    if (!Utils.implements(GwikiBridge.interface, this.bridge)) throw "You must provide an instance of GwikiBridge to initialize a GwikiUI.";

    // Initialize gwiki with bridge
    this.gwiki.init(this.bridge);

    // Add event listeners
    // Errors
    this.gwiki.addEventListener('error', function(e) { t.block(e.message); });

    // Information updates
    this.gwiki.addEventListener('setHome', function(e) { t.onSetHome(e); });
    this.gwiki.addEventListener('setCurrentItem', function(e) { t.onSetCurrentItem(e); });
    this.gwiki.addEventListener('rectifyTree', function(e) { t.drawSideMenu(e); t.updateMenuSelections(e); });
    this.gwiki.addEventListener('updateNavStack', function(e) { t.drawBreadcrumbs(e); });

    // Signin status
    this.bridge.addEventListener('signinStatusChanged', function(e) { t.toggleSignedIn(); });

    this.updateFromUrl();
    this.initialized = true;
}



// Refreshes state variables from url and gets new data, if necessary
GwikiUI.prototype.updateFromUrl = function() {
    var path, home, doc, re;

    // Parse initial information from url
    // If we're using pretty urls,
    if (this.config.prettyUrls) {
        var path = window.location.pathname;
        
        // If a path is given,
        if (path != '/') {
            path = path.substr(1).split('/');

            // If the path has two parts,
            if (path.length == '2') {
                // Then set home and doc
                home = path[0];
                doc = path[1];

            // Otherwise, set doc if defaultHome was provided, or home if not
            } else {
                if (this.defaultHome) doc = path[0];
                else home = path[0]
            }
        }

    // Otherwise, use the query string to get params
    } else {
        if (!this.defaultHome) {
            re = new RegExp('\\bhome=('+GwikiUI.validGoogleId+')');
            home = window.location.search.match(re);
            if (home) home = home[1];
        }
        re = new RegExp('\\bdoc=('+GwikiUI.validGoogleId+')');
        doc = window.location.search.match(re);
        if (doc) doc = doc[1];
    }

    // If we have a default home, override with that
    if (this.defaultHome) home = this.defaultHome;

    this.updateState(home, doc);
}



// When home is set
GwikiUI.prototype.onSetHome = function(e) {
    if (e.target.home) this.home = e.target.home.id;
    else this.home = null;
    this.updateState(this.home, this.doc);
    this.drawHeader();
    this.loading(false);
}



// When currentItem is set
GwikiUI.prototype.onSetCurrentItem = function(e) {
    if (e.target.currentItem) this.doc = e.target.currentItem.id;
    else this.doc = false;
    this.updateState(this.home, this.doc);
    this.drawMainContent();
    this.loading(false);
}



// On first load or when resetting home
GwikiUI.prototype.askForHome = function() {
    var t = this;
    var str = '<form action="?" method="GET" class="homeForm"><label for="homeFolder">'+GwikiUI.strings['prompt-homefolder']+'<input type="text" id="homeFolder" value="'+(this.gwiki.home || '')+'" placeholder="e.g., https://drive.google.com/folders/2gja3lkaw3j-faoejsdlkalgalskdga"> <button type="submit">Ok</button></form>';
    var blocker = this.block(str);
    blocker.getElementsByTagName('form')[0].addEventListener('submit', function(e) {
        e.preventDefault();

        var link = document.getElementById("homeFolder").value;

        var folderId = t.getIdFromUrl(link);

        // Show error if no valid id found
        if (!folderId) alert('Invalid Id! Please enter either the full url from a google drive folder, or just the id part.');
        else {
            t.loading(true);
            t.gwiki.setHome(folderId, t.doc);
        }
    });
}



// Toggle the signin sheet
GwikiUI.prototype.toggleSignedIn = function() {
    var t = this;
    if (this.bridge.signedIn) {
        this.unblock();
        if (!this.gwiki.home) {
            if (this.home) this.gwiki.setHome(this.home, this.doc);
            else this.askForHome();
        } else {
            this.drawHeader();
            if (this.gwiki.currentItem.id == this.doc) this.drawMainContent();
            else this.gwiki.setCurrentItem(this.doc);
        }
    } else {
        this.block(GwikiUI.strings.displayTitle + GwikiUI.strings.tagline + GwikiUI.strings.signinButton);
        
        // Load signin button
        var btn = this.blocker.getElementsByClassName('g-signin');
        if (btn.length == 0) return;
        btn = btn[0];
        btn.addEventListener('click', function(e) { t.loading(true); t.bridge.signin(); });
    }
}



// Rebuild essential elements of frame
GwikiUI.prototype.drawHeader = function() {
    var t = this;

    // Title
    this.siteTitle.innerHTML = this.gwiki.home.displayName;
    this.siteTitle.gobject = this.gwiki.home;


    // Main Nav
    this.mainMenuContainer.innerHTML = '';
    this.mainMenu = [];

    for (var i = 0, child; i < this.gwiki.home.children.length; i++) {
        child = this.gwiki.home.children[i];
        this.mainMenu[i] = document.createElement('a');
        this.mainMenu[i].href = "#"+child.id;
        this.mainMenu[i].innerHTML = child.displayName;
        this.mainMenu[i].setAttribute('data-gid', child.id);
        this.mainMenu[i].gobject = child;
        this.mainMenuContainer.appendChild(this.mainMenu[i]);

        // Click listener
        this.mainMenu[i].addEventListener('click', function(e) {
            e.preventDefault();
            t.gwiki.setCurrentItem(e.target.gobject, false);
        });
    }
}



// Rebuild the interface elements pertaining to "item"
GwikiUI.prototype.drawMainContent = function() {
    var t = this;

    // If we can't get content, say so
    if (!this.gwiki.currentItem.bodySrc) {
        this.mainContent.innerHTML = GwikiUI.strings['errNoContent'].replace('$id', this.gwiki.currentItem.id);

    // Otherwise, set content
    } else {
        if (this.gwiki.currentItem.bodySrc.gwikiType == 'text/markdown') this.mainContent.innerHTML = this.parseMarkdown(this.gwiki.currentItem.body);
        else if (this.gwiki.currentItem.bodySrc.gwikiType == 'text/html') this.mainContent.innerHTML = this.cleanHtml(this.gwiki.currentItem.body);
        else {
            var str = this.getEmbedString();
            this.mainContent.innerHTML = this.getEmbedString();
        }
        this.parseContentLinks();
    }

    // Now scroll to the top
    this.mainContent.scrollTop = 0;
}


GwikiUI.prototype.updateMenuSelections = function() {
    var selected = this.getSelectedSubtree();

    // Do main menu
    for (var i = 0; i < this.mainMenu.length; i++) {
        if (selected && this.mainMenu[i].gobject.id == selected.id) this.mainMenu[i].classList.add('selected');
        else this.mainMenu[i].classList.remove('selected');
    }

    // Submenu is already done. Exit.
    return true;
}



GwikiUI.prototype.drawSideMenu = function() {
    // Clear submenu
    this.subMenu = [];
    this.subMenuContainer.innerHTML = '';

    var subtree = this.getSelectedSubtree();
    if (!subtree) {
        // If we're home, then of course there's no menu; just return
        if (this.gwiki.currentItem.isHome) return;

        // Otherwise, show an error
        this.subMenuContainer.innerHTML = GwikiUI.strings['errNoSubtree'];
        console.warn(GwikiUI.strings['warnNoSubtree']);
        console.log(this.gwiki.currentItem);
        return false;
    }

    this.subMenuContainer.appendChild(this.buildHierarchicalMenu(subtree));
}


GwikiUI.prototype.buildHierarchicalMenu = function(node) {
    var t = this, item, container, submenu;

    container = document.createElement('div');
    container.className = 'menu-container';

    item = document.createElement('a');
    item.href = "#"+node.id;
    item.innerHTML = node.displayName;
    item.setAttribute('data-gid', node.id);
    item.gobject = node;

    // Click listener
    item.addEventListener('click', function(e) {
        e.preventDefault();
        t.gwiki.setCurrentItem(node, false);
    });

    // Mark selected, if pertinent
    var p = this.gwiki.currentItem, selected = false;
    while (p.parents && !p.isHome) {
        if (p.id == node.id) {
            item.classList.add('selected');
            selected = true;
            break;
        }
        p = p.parents[0];
    }

    container.appendChild(item);

    // If this is a selected node and has children, show them
    if (selected && node.children && node.children.length > 0) {
        for (var i = 0; i < node.children.length; i++) container.appendChild(this.buildHierarchicalMenu(node.children[i]));
    }

    return container;
}


GwikiUI.prototype.drawBreadcrumbs = function() {
}



GwikiUI.prototype.getSelectedSubtree = function() {
    var selected;
    if (this.gwiki.currentItem.isHome) selected = null;
    else {
        selected = this.gwiki.currentItem;
        while (selected.parents && !selected.parents[0].isHome) selected = selected.parents[0];
    }
    if (selected && !selected.parents[0].isHome) selected = null;
    return selected;
}



// Block the interface with an optional message or sub interface
GwikiUI.prototype.block = function(str) {
    if (!this.blocker) {
        this.blocker = document.createElement('div');
        this.blocker.className = 'blocker';
        this.root.appendChild(this.blocker);
    }

    this.blocker.innerHTML = '<div class="content">'+str+'</div>';
    return this.blocker;
}



// Unblock the interface
GwikiUI.prototype.unblock = function() {
    if (this.blocker) {
        this.blocker.parentElement.removeChild(this.blocker);
        this.blocker = null;
    }
}



// Loading
GwikiUI.prototype.loading = function(loading) {
    if (loading) this.block(GwikiUI.strings.displayTitle + GwikiUI.strings.tagline + GwikiUI.strings.loading);
    else this.unblock();
}














// Utility functions and extras

GwikiUI.prototype.updateState = function(home, doc) {
    if (home) this.home = home;
    if (doc) this.doc = doc;

    var title = [], state = {}, url = [];

    // Do title
    if (this.gwiki.currentItem) title.push(this.gwiki.currentItem.displayName);
    if (this.gwiki.home) title.push(this.gwiki.home.displayName);
    if (title.length > 0) title = title.join(' - ');
    else title = GwikiUI.strings.title;

    // Do URL
    // If using prettyUrls,
    if (this.config.prettyUrls) {
        // Build the url from parts
        if (this.defaultHome) {
            if (this.doc) url.push('/' + this.doc);
        } else if (this.home) {
            url.push('/' + this.home);
            if (this.doc) url.push('/' + this.doc);
        }
        url = url.join('');

        // Don't change anything if we haven't changed pages
        if (url == '') url = '/';
        if (url == window.location.pathname) return;

        // Otherwise, fix url and fall through to pushState
        if (url == '/') url = '';

    // If not using prettyUrls,
    } else {
        var query = {};
        url = window.location.search;

        // Get current url parameters
        if (url.length > 0) url = url.substr(1);
        url = url.split('&');
        for (var i = 0, parts; i < url.length; i++) {
            parts = url[i].split('=');
            query[parts.shift()] = parts.join('=');
        }

        // If we're not changing anything, get out
        if (query.doc == this.doc && query.home == this.home) return;

        // If we've set a default home, suppress inclusion of home variable
        if (this.defaultHome) {
            if (typeof query.home != 'undefined') delete query.home;

        // Otherwise, set to current home, or delete if no current home
        } else {
            if (this.home) query.home = this.home;
            else delete query.home;
        }
        
        // Add doc, or delete if not available
        if (this.doc) query.doc = this.doc;
        else delete query.doc;

        // Reconstruct url
        url = [];
        for (var x in query){
            if (x != '') url.push(x+'='+query[x]);
        }
        url = '?' + url.join('&');

        // Fall through to pushState
    }

    // Do the work
    window.history.pushState({ 'home' : this.home, 'doc' : this.doc }, title, url);
    document.title = title;
}



GwikiUI.prototype.cleanHtml = function(html) {
    var st = html.indexOf('<body>');
    if (st > -1) html = html.substr(st+6);

    var end = html.indexOf('</body>');
    if (end > -1) html = html.substr(0, end);

    return html;
}



GwikiUI.prototype.getEmbedString = function() {
    var i = this.gwiki.currentItem;
    if (i.bodySrc) return '<iframe class="google-doc" src="https://drive.google.com/file/d/'+i.bodySrc.id+'/preview">';
    //else return GwikiUI.strings['errUnknownEmbedType'].replace('$type', i.mimeType);
    else return '';
}



GwikiUI.prototype.parseMarkdown = function(md) {
    if (!(this.markdownParser instanceof Markdown.Converter)) {
        if (typeof this.markdownParser == 'function') this.markdownParser.call(this);
        else throw "this.markdownParser must be either an instance of Markdown.Converter or a container function that yields a Markdown.Converter";
    }
    return this.markdownParser.makeHtml(md);
}



GwikiUI.prototype.parseContentLinks = function() {
    var t = this, docId;
    var links = this.mainContent.getElementsByTagName('a');
    for (var i = 0; i < links.length; i++) {
        // If we're instructed not to touch it, don't touch it
        if (links[i].classList.contains('gwiki-passthrough')) continue;

        // If this is a google drive link, try to load it on this page
        // TODO: Figure out how to fall back if this is not a page in this hierarchy
        docId = this.getIdFromUrl(links[i].href);
        if (docId) {
            (function(gid) {
                links[i].addEventListener('click', function(e) {
                    // If we can't figure it out, leave it
                    if (!gid) {
                        e.target.target = '_blank';
                        return true;
                    }

                    // Otherwise, redirect it
                    e.preventDefault();
                    t.gwiki.setCurrentItem(gid);
                });
            })(docId);

        // If it's not a google link, make sure it opens outside
        } else {
            links[i].target = "_blank";
        }
    }
}


GwikiUI.prototype.getIdFromUrl = function(url) {
    var re = new RegExp('^'+GwikiUI.validGoogleId+'$');
    var folderId = url.match(re);
    if (folderId) folderId = folderId[0];
    else {
        re = new RegExp('(drive|docs|spreadsheets)\.google\.com/.+?\\bid(=|%3D)('+GwikiUI.validGoogleId+')');
        folderId = url.match(re);
        if (folderId) folderId = folderId[3];
        else {
            re = new RegExp('(drive|docs|spreadsheets)\.google\.com/.+/('+GwikiUI.validGoogleId+')(/|\\?|$)');
            folderId = url.match(re);
            if (folderId) folderId = folderId[2];
        }
    }
    return folderId;
}





// Class constants

GwikiUI.validGoogleId = '[a-zA-Z0-9_-]{16,}';

GwikiUI.strings = {
    'title' : 'Gwiki',
    'displayTitle' : '<h1>Gwiki</h1>',
    'tagline' : '<p>A wiki interface for Google Drive</p>',
    'loading' : '<p>Loading...</p>',
    'signinButton' : '<p><img class="g-signin" src="/assets/imgs/btn_google_signin_dark_normal_web.png"></p>',
    'signedOut' : '<p>You were signed out! Please sign in again.</p>',
    'prompt-homefolder' : 'Home Folder: ',

    'errNoContent' : '<h1>No Content</h1><p>Sorry, it looks like this is an empty folder. You can add content to it by simply adding docs to it. Open the folder  <a href="https://drive.google.com/drive/folders/$id" target="_blank">here</a> to add some content.',
    'errUnknownEmbedType' : '<h1>Unknown Type</h1><p>Sorry, I\'m not sure how to handle this document. You can register a handler for this document type by overriding the <code>Gwiki.prototype.getEmbedString</code> method, but be sure that if you do, you capture the previous method and call it, too, so you can be sure to handle all of the already-supported types.</p><p>The type you need to handle is $type.</p>',
    'errNoSubtree' : '(menu not available)',

    'warnNoSubtree' : 'The currently selected page doesn\'t appear to be contained within the home folder you\'ve set. See object dump below:'
}

