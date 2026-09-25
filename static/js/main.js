(() => {

    const body = document.body;

    const sidebarToggle =
        document.getElementById('ff-sidebar-toggle');

    const mobileMenu =
        document.getElementById('ff-mobile-menu');

    const sidebarOverlay =
        document.getElementById('ff-sidebar-overlay');

    const STORAGE_KEY =
        'finflow-sidebar-collapsed';


    /* ========================================================
       DESKTOP SIDEBAR
       ======================================================== */

    function updateToggle(collapsed) {

        if (!sidebarToggle) {
            return;
        }

        const icon =
            sidebarToggle.querySelector('i');

        if (icon) {

            icon.className =
                collapsed
                    ? 'bi bi-grip-vertical'
                    : 'bi bi-list';
        }

        sidebarToggle.setAttribute(
            'aria-label',
            collapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
        );

        sidebarToggle.setAttribute(
            'title',
            collapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
        );
    }


    function setSidebarCollapsed(
        collapsed,
        persist = true
    ) {

        body.classList.toggle(
            'ff-sidebar-collapsed',
            collapsed
        );

        updateToggle(collapsed);

        if (persist) {

            try {

                localStorage.setItem(
                    STORAGE_KEY,
                    collapsed ? '1' : '0'
                );

            } catch (error) {
                /* localStorage unavailable */
            }
        }
    }


    function restoreSidebarState() {

        let saved = null;

        try {
            saved =
                localStorage.getItem(STORAGE_KEY);

        } catch (error) {
            saved = null;
        }

        const collapsed = saved === '1';

        setSidebarCollapsed(
            collapsed,
            false
        );

        document.documentElement.classList.remove(
            'ff-sidebar-precollapsed'
        );
    }


    sidebarToggle?.addEventListener(
        'click',
        () => {

            const collapsed =
                body.classList.contains(
                    'ff-sidebar-collapsed'
                );

            setSidebarCollapsed(
                !collapsed,
                true
            );
        }
    );


    /* ========================================================
       MOBILE SIDEBAR
       ======================================================== */

    function openMobileSidebar() {

        body.classList.add(
            'ff-mobile-sidebar-open'
        );
    }


    function closeMobileSidebar() {

        body.classList.remove(
            'ff-mobile-sidebar-open'
        );
    }


    mobileMenu?.addEventListener(
        'click',
        openMobileSidebar
    );


    sidebarOverlay?.addEventListener(
        'click',
        closeMobileSidebar
    );


    document
        .querySelectorAll('.ff-nav-item')
        .forEach(item => {

            item.addEventListener(
                'click',
                () => {

                    if (
                        window.innerWidth <= 760
                    ) {
                        closeMobileSidebar();
                    }
                }
            );
        });


    document.addEventListener(
        'keydown',
        event => {

            if (event.key === 'Escape') {
                closeMobileSidebar();
            }
        }
    );


    /* ========================================================
       LANGUAGE SWITCHER
       ======================================================== */

    function updateLanguageButtons(lang) {

        document
            .querySelectorAll('.ff-language-button')
            .forEach(button => {

                const active =
                    button.dataset.lang === lang;

                button.classList.toggle(
                    'is-active',
                    active
                );

                button.setAttribute(
                    'aria-pressed',
                    active ? 'true' : 'false'
                );
            });
    }


    function initLanguageSwitcher() {

        const i18n = window.finflowI18n;

        if (!i18n) {
            console.warn(
                '[FinFlow] i18n is not loaded'
            );
            return;
        }

        updateLanguageButtons(
            i18n.getLanguage()
        );

        document
            .querySelectorAll('.ff-language-button')
            .forEach(button => {

                button.addEventListener(
                    'click',
                    () => {

                        const lang =
                            button.dataset.lang;

                        if (
                            lang !== 'uk' &&
                            lang !== 'en'
                        ) {
                            return;
                        }

                        i18n.setLang(lang);
                    }
                );
            });


        window.addEventListener(
            'finflow-language-changed',
            event => {

                const lang =
                    event.detail?.lang ||
                    i18n.getLanguage();

                updateLanguageButtons(lang);
            }
        );
    }


    /* ========================================================
       USER MENU
       ======================================================== */

    const userMenuButton =
        document.getElementById('ff-user-menu-button');

    const userMenu =
        document.getElementById('ff-user-menu');

    const logoutButton =
        document.getElementById('ff-logout-button');

    const logoutForm =
        document.getElementById('ff-logout-form');


    function closeUserMenu() {

        if (!userMenu || !userMenuButton) {
            return;
        }

        userMenu.hidden = true;

        userMenuButton.setAttribute(
            'aria-expanded',
            'false'
        );
    }


    function openUserMenu() {

        if (!userMenu || !userMenuButton) {
            return;
        }

        userMenu.hidden = false;

        userMenuButton.setAttribute(
            'aria-expanded',
            'true'
        );
    }


    if (userMenuButton && userMenu) {

        userMenuButton.addEventListener(
            'click',
            event => {

                event.stopPropagation();

                if (userMenu.hidden) {
                    openUserMenu();
                } else {
                    closeUserMenu();
                }
            }
        );


        userMenu.addEventListener(
            'click',
            event => {
                event.stopPropagation();
            }
        );


        document.addEventListener(
            'click',
            () => {
                closeUserMenu();
            }
        );


        document.addEventListener(
            'keydown',
            event => {

                if (event.key === 'Escape') {
                    closeUserMenu();
                }
            }
        );
    }


    if (logoutButton && logoutForm) {

        logoutButton.addEventListener(
            'click',
            () => {

                logoutButton.disabled = true;

                logoutForm.submit();
            }
        );
    }


    /* ========================================================
       INITIAL STATE
       ======================================================== */

    restoreSidebarState();
    initLanguageSwitcher();

})();
