/* ============================================
   KNOWLEDGE JOURNAL — Application Logic
   ============================================ */

(() => {
    'use strict';

    // ---- Supabase Config ----
    const SUPABASE_URL = 'https://nhlxvsgkepaqqnfoqxqb.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5obHh2c2drZXBhcXFuZm9xeHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMjIzOTIsImV4cCI6MjEwMDY5ODM5Mn0.JmRdrrnCyIbkEIbM7aBs2AZ0hKznWdqKAcRCYxs6mBo';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Default Categories from Screenshot
    const DEFAULT_CATEGORIES = [
        { id: 'cat-writing', name: 'Writing', emoji: '🖊️', color: '#7C8B76' },
        { id: 'cat-research', name: 'Research', emoji: '🔍', color: '#7C8B76' },
        { id: 'cat-images', name: 'Images', emoji: '🏔️', color: '#7C8B76' },
        { id: 'cat-video', name: 'Video', emoji: '▷', color: '#7C8B76' },
        { id: 'cat-audio', name: 'Audio', emoji: '🎛️', color: '#7C8B76' },
        { id: 'cat-design', name: 'Design', emoji: '🖌️', color: '#7C8B76' },
        { id: 'cat-automation', name: 'Automation', emoji: '⚙️', color: '#7C8B76' }
    ];

    // State
    let categories = [];
    let articles = [];
    let comments = [];
    let likesMap = {};
    let viewsMap = {};
    let currentCategoryId = null;
    let currentArticleId = null;
    let editingArticleId = null;
    let editingCategoryId = null;
    let deleteAction = null;

    // DOM Elements
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const viewLanding = $('#view-landing');
    const viewHome = $('#view-home');
    const viewCategoryArticles = $('#view-category-articles');
    const viewArticleDetail = $('#view-article-detail');
    const viewAllCategories = $('#view-all-categories');

    const categoriesGrid = $('#categories-grid');
    const articlesGrid = $('#articles-grid');
    const homeArticlesGrid = $('#home-articles-grid');
    const emptyArticles = $('#empty-articles');

    const searchCatInput = $('#search-cat-input');
    const searchHomeInput = $('#search-home-input');

    const modalArticle = $('#modal-article');
    const modalConfirm = $('#modal-confirm');
    const modalEditCat = $('#modal-edit-cat');
    const modalCatManage = $('#modal-cat-manage');

    const progressBar = $('#reading-progress-bar');

    // Utility Functions
    function formatDate(ts) {
        if (!ts) ts = Date.now();
        const d = new Date(ts);
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function calcReadTime(text) {
        if (!text) return 1;
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        return Math.max(1, Math.ceil(words / 180));
    }

    function renderMarkdown(content) {
        if (!content) return '';
        let html = escapeHtml(content);
        // Code block
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Restore Underline
        html = html.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, '<u>$1</u>');
        // Strikethrough
        html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');
        // Bold
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // Italic
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        // Blockquote
        html = html.replace(/^&gt; (.*$)/gim, '<blockquote>$1</blockquote>');
        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        // Bullet list
        html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
        // Numbered list
        html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');
        // Line breaks to paragraphs
        const paragraphs = html.split(/\n\n+/);
        return paragraphs.map(p => {
            if (p.startsWith('<h') || p.startsWith('<pre') || p.startsWith('<block') || p.startsWith('<li')) return p;
            return `<p>${p.replace(/\n/g, '<br>')}</p>`;
        }).join('');
    }

    function showToast(msg) {
        const container = $('#toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    function updateNavPillPosition() {
        const activeItem = $('.nav-center-menu .nav-menu-item.active');
        const pillBg = $('#nav-active-pill-bg');
        const navContainer = $('.nav-center-menu');
        if (activeItem && pillBg && navContainer) {
            const containerRect = navContainer.getBoundingClientRect();
            const itemRect = activeItem.getBoundingClientRect();
            const left = itemRect.left - containerRect.left;
            const width = itemRect.width;
            pillBg.style.left = `${left}px`;
            pillBg.style.width = `${width}px`;
            pillBg.style.opacity = '1';
        } else if (pillBg) {
            pillBg.style.opacity = '0';
        }
    }

    window.addEventListener('resize', updateNavPillPosition);

    // Navigation Switcher
    function showView(viewId) {
        [viewLanding, viewHome, viewCategoryArticles, viewArticleDetail, viewAllCategories].forEach(v => v?.classList.remove('active'));
        $(`#${viewId}`)?.classList.add('active');
        window.scrollTo(0, 0);

        // Control visibility of .nav-left-group & .nav-right-group (Only visible on Trang chủ)
        const navLeftGroup = $('.nav-left-group');
        const navRightGroup = $('.nav-right-group');
        if (navLeftGroup) {
            navLeftGroup.style.display = (viewId === 'view-home') ? 'flex' : 'none';
        }
        if (navRightGroup) {
            navRightGroup.style.display = (viewId === 'view-home') ? 'flex' : 'none';
        }

        // Update nav items active state
        if (viewId === 'view-landing') {
            $('#nav-item-landing')?.classList.add('active');
            $('#nav-item-home')?.classList.remove('active');
            $('#nav-item-categories')?.classList.remove('active');
        } else if (viewId === 'view-home') {
            $('#nav-item-landing')?.classList.remove('active');
            $('#nav-item-home')?.classList.add('active');
            $('#nav-item-categories')?.classList.remove('active');
        } else if (viewId === 'view-all-categories') {
            $('#nav-item-landing')?.classList.remove('active');
            $('#nav-item-home')?.classList.remove('active');
            $('#nav-item-categories')?.classList.add('active');
        } else {
            $('#nav-item-landing')?.classList.remove('active');
            $('#nav-item-home')?.classList.remove('active');
            $('#nav-item-categories')?.classList.remove('active');
        }

        // Trigger smooth sliding pill animation
        requestAnimationFrame(updateNavPillPosition);
    }

    // Reading Progress Bar on Scroll
    window.addEventListener('scroll', () => {
        if (!viewArticleDetail.classList.contains('active')) {
            if (progressBar) progressBar.style.width = '0%';
            return;
        }
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = totalHeight > 0 ? (window.scrollY / totalHeight) * 100 : 0;
        if (progressBar) progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    });

    // ============================================================
    //  SUPABASE / LOCAL STORAGE DATA
    // ============================================================

    function getLocalCategories() {
        try {
            const raw = localStorage.getItem('emir_categories');
            return raw !== null ? JSON.parse(raw) : DEFAULT_CATEGORIES;
        } catch { return DEFAULT_CATEGORIES; }
    }

    function saveLocalCategories(cats) {
        try { localStorage.setItem('emir_categories', JSON.stringify(cats)); } catch {}
    }

    function getLocalArticles() {
        try {
            const raw = localStorage.getItem('emir_articles');
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    function saveLocalArticles(arts) {
        try { localStorage.setItem('emir_articles', JSON.stringify(arts)); } catch {}
    }

    function getLocalComments() {
        try {
            const raw = localStorage.getItem('emir_comments');
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    function saveLocalComments(cmts) {
        try { localStorage.setItem('emir_comments', JSON.stringify(cmts)); } catch {}
    }

    function getLocalViews() {
        try {
            const raw = localStorage.getItem('emir_views');
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }

    function saveLocalViews(views) {
        try { localStorage.setItem('emir_views', JSON.stringify(views)); } catch {}
    }

    function getLocalLikes() {
        try {
            const raw = localStorage.getItem('emir_likes');
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }

    function saveLocalLikes(likes) {
        try { localStorage.setItem('emir_likes', JSON.stringify(likes)); } catch {}
    }

    async function fetchAllData() {
        categories = getLocalCategories();
        articles = getLocalArticles();
        comments = getLocalComments();
        likesMap = getLocalLikes();
        viewsMap = getLocalViews();

        try {
            const { data: catData, error: catErr } = await supabase.from('topics').select('*');
            if (!catErr && catData) {
                if (catData.length > 0) {
                    categories = catData;
                    saveLocalCategories(categories);
                } else if (localStorage.getItem('emir_categories') === null) {
                    categories = DEFAULT_CATEGORIES;
                    saveLocalCategories(categories);
                }
            }

            const { data: artData, error: artErr } = await supabase.from('entries').select('*');
            if (!artErr && artData && artData.length > 0) {
                articles = artData;
                saveLocalArticles(articles);
            }

            const { data: cmtData, error: cmtErr } = await supabase.from('comments').select('*');
            if (!cmtErr && cmtData && cmtData.length > 0) {
                comments = cmtData;
                saveLocalComments(comments);
            }
        } catch (e) {
            console.warn('Supabase fetch exception, using local fallback:', e);
        }
    }

    // ============================================================
    //  SCREEN 0: LANDING PAGE — SHOWCASE & INTRO
    // ============================================================

    function renderLandingPage() {
        if ($('#landing-stat-articles')) $('#landing-stat-articles').textContent = articles.length;
        if ($('#landing-stat-categories')) $('#landing-stat-categories').textContent = categories.length;
        if ($('#landing-stat-comments')) $('#landing-stat-comments').textContent = comments.length;
    }

    // ============================================================
    //  SCREEN 1: HOME — MAGAZINE BLOGGER LAYOUT
    // ============================================================

    function renderHomeStats() {
        if ($('#stat-total-articles')) $('#stat-total-articles').textContent = articles.length;
        if ($('#stat-total-categories')) $('#stat-total-categories').textContent = categories.length;
        if ($('#stat-total-comments')) $('#stat-total-comments').textContent = comments.length;
    }

    function renderFeaturedPost() {
        const container = $('#featured-post-container');
        if (!container) return;

        if (articles.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';

        // Up to 3 pinned articles, or 1 latest article as fallback
        const pinnedList = articles.filter(a => a.is_pinned);
        const featuredItems = pinnedList.length > 0 ? pinnedList.slice(0, 3) : articles.slice(0, 1);
        const isMulti = featuredItems.length > 1;

        container.innerHTML = `
            <div class="featured-cards-list">
                ${featuredItems.map(item => {
                    const cat = categories.find(c => String(c.id) === String(item.topic_id) || String(c.id) === String(item.category_id) || c.name === item.category_name) || { name: 'Nổi bật', emoji: '✨' };
                    const readTime = calcReadTime(item.content);
                    const excerpt = item.content ? item.content.replace(/[#*`]/g, '').slice(0, 160) + '...' : 'Không có xem trước';

                    return `
                        <div class="featured-card" data-id="${item.id}">
                            <div class="featured-badge-row">
                                <span class="featured-tag">🔥 BÀI VIẾT NỔI BẬT</span>
                                <span class="cat-pill-badge" style="background:rgba(255,255,255,0.15);color:white;">${cat.emoji || '📖'} ${escapeHtml(cat.name)}</span>
                                <span class="featured-read-time">⏱️ ${readTime} phút đọc</span>
                            </div>
                            <h2 class="featured-title">${escapeHtml(item.title)}</h2>
                            <p class="featured-excerpt">${escapeHtml(excerpt)}</p>
                            <div class="featured-footer">
                                <div class="featured-author">
                                    <div class="author-avatar">K</div>
                                    <span class="author-name-text">Blogger Knowledge</span>
                                </div>
                                <span class="btn-read-featured">Đọc bài viết ➔</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        container.querySelectorAll('.featured-card').forEach(card => {
            card.addEventListener('click', () => {
                openArticleDetailView(card.dataset.id);
            });
        });
    }

    function renderCategoryGrid() {
        if (!categoriesGrid) return;

        // Sort categories by article count in descending order
        const sortedCats = [...categories].map(cat => {
            const count = articles.filter(a => String(a.topic_id) === String(cat.id) || String(a.category_id) === String(cat.id) || a.category_name === cat.name).length;
            return { ...cat, count };
        }).sort((a, b) => b.count - a.count);

        // Take Top 5
        const top5 = sortedCats.slice(0, 5);

        categoriesGrid.innerHTML = top5.map(cat => {
            return `
                <div class="top-cat-item" data-id="${cat.id}">
                    <div class="top-cat-item-left">
                        <span style="font-size:1.1rem;">${cat.emoji || '📖'}</span>
                        <span class="top-cat-name">${escapeHtml(cat.name)}</span>
                    </div>
                    <span class="top-cat-count">${cat.count} bài</span>
                </div>
            `;
        }).join('');

        categoriesGrid.querySelectorAll('.top-cat-item').forEach(item => {
            item.addEventListener('click', () => {
                openCategoryView(item.dataset.id);
            });
        });
    }

    function renderAllCategoriesPage(filter = '') {
        const container = $('#all-categories-full-grid');
        if (!container) return;

        const filtered = categories.filter(c => !filter || c.name.toLowerCase().includes(filter.toLowerCase()));

        if (filtered.length === 0) {
            container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:4rem;color:var(--text-sage);font-weight:600;">Không tìm thấy chủ đề nào phù hợp.</div>`;
            return;
        }

        container.innerHTML = filtered.map(cat => {
            const catArticles = articles.filter(a => String(a.topic_id) === String(cat.id) || String(a.category_id) === String(cat.id) || a.category_name === cat.name);
            const count = catArticles.length;
            const recentPosts = catArticles.slice(0, 2);

            return `
                <div class="cat-full-card" data-id="${cat.id}">
                    <div class="cat-card-top-cover">
                        <div class="cat-card-header-flex">
                            <div class="cat-card-hero-icon">${cat.emoji || '📖'}</div>
                            <div class="cat-card-actions-group">
                                <button type="button" class="btn-edit-cat-circle" data-id="${cat.id}" title="Chỉnh sửa chủ đề">
                                    ⚙️
                                </button>
                            </div>
                        </div>

                        <div class="cat-card-main-info">
                            <h3>${escapeHtml(cat.name)}</h3>
                            <div class="cat-card-meta-bar">
                                <span class="cat-count-pill">
                                    <span class="live-dot"></span>
                                    ${count} bài viết
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="cat-card-body-content">
                        ${recentPosts.length > 0 ? `
                            <div class="cat-recent-posts-list">
                                ${recentPosts.map(p => `
                                    <div class="recent-post-row" data-art-id="${p.id}" title="${escapeHtml(p.title)}">
                                        <span class="row-icon">📄</span>
                                        <span class="row-title">${escapeHtml(p.title)}</span>
                                        <span class="row-arrow">➔</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <div class="cat-empty-notice">
                                <span>✨ Chưa có bài viết nào</span>
                            </div>
                        `}
                    </div>

                    <div class="cat-card-bottom-btn">
                        <button type="button" class="btn-explore-cat" data-id="${cat.id}">
                            <span>Xem tất cả bài viết</span>
                            <span class="btn-arrow">➔</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.cat-full-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const editBtn = e.target.closest('.btn-edit-cat-circle');
                const postRow = e.target.closest('.recent-post-row');
                if (editBtn) {
                    e.stopPropagation();
                    openEditCategoryModal(editBtn.dataset.id);
                } else if (postRow) {
                    e.stopPropagation();
                    openArticleDetailView(postRow.dataset.artId);
                } else {
                    openCategoryView(card.dataset.id);
                }
            });
        });
    }

    $('#search-all-cats-input')?.addEventListener('input', (e) => {
        renderAllCategoriesPage(e.target.value.trim());
    });

    function renderHomeArticlesGrid(filter = '') {
        if (!homeArticlesGrid) return;

        const filtered = articles.filter(a => {
            return !filter || a.title.toLowerCase().includes(filter.toLowerCase()) || (a.content && a.content.toLowerCase().includes(filter.toLowerCase()));
        });

        if (filtered.length === 0) {
            homeArticlesGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-sage);">Không tìm thấy bài viết nào phù hợp.</div>`;
            return;
        }

        // Sort: Pinned posts come first
        const sorted = [...filtered].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));

        homeArticlesGrid.innerHTML = sorted.map(art => {
            const cat = categories.find(c => String(c.id) === String(art.topic_id) || String(c.id) === String(art.category_id) || c.name === art.category_name) || { name: 'Chủ đề', emoji: '📖' };
            const tags = Array.isArray(art.tags) ? art.tags : (art.tags ? art.tags.split(',') : []);
            const excerpt = art.content ? art.content.replace(/[#*`]/g, '').slice(0, 100) + '...' : 'Không có xem trước';
            const readTime = calcReadTime(art.content);
            const commentCount = comments.filter(c => String(c.entry_id) === String(art.id) || String(c.article_id) === String(art.id)).length;
            const likes = likesMap[art.id] || 0;

            return `
                <div class="article-card" data-id="${art.id}">
                    <div>
                        <div class="card-top-meta">
                            <div style="display:flex;align-items:center;gap:0.4rem;">
                                <span class="card-cat-badge">${cat.emoji || '📖'} ${escapeHtml(cat.name)}</span>
                            </div>
                        </div>
                        <h3 class="article-card-title" style="margin-top:0.6rem;">${escapeHtml(art.title)}</h3>
                        <p class="article-card-excerpt" style="margin-top:0.4rem;">${escapeHtml(excerpt)}</p>
                    </div>
                    <div>
                        ${tags.length ? `
                            <div class="article-card-tags" style="margin-bottom:0.75rem;">
                                ${tags.map(t => `<span class="tag-chip">${escapeHtml(t.trim())}</span>`).join('')}
                            </div>
                        ` : ''}
                        <div class="card-bottom-bar">
                            <span>⏱️ ${readTime} phút đọc</span>
                            <div style="display:flex;gap:0.75rem;">
                                ${likes > 0 ? `<span>❤️ ${likes}</span>` : ''}
                                <span>💬 ${commentCount}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        homeArticlesGrid.querySelectorAll('.article-card').forEach(card => {
            card.addEventListener('click', () => {
                openArticleDetailView(card.dataset.id);
            });
        });
    }

    function renderTopViewsWidget() {
        const container = $('#top-views-container');
        if (!container) return;

        if (articles.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:1rem;color:var(--text-sage);font-size:0.85rem;">Chưa có bài viết nào.</div>`;
            return;
        }

        // Sort articles by views count descending (fallback to likes or date)
        const sortedByViews = [...articles].map(art => {
            const views = viewsMap[art.id] || 0;
            return { ...art, views };
        }).sort((a, b) => b.views - a.views || (likesMap[b.id] || 0) - (likesMap[a.id] || 0));

        const top5Views = sortedByViews.slice(0, 5);

        container.innerHTML = top5Views.map((art, idx) => {
            const cat = categories.find(c => String(c.id) === String(art.topic_id) || String(c.id) === String(art.category_id) || c.name === art.category_name) || { name: 'Chủ đề', emoji: '📖' };
            return `
                <div class="top-view-item" data-id="${art.id}">
                    <div class="top-view-rank">#${idx + 1}</div>
                    <div class="top-view-main">
                        <span class="top-view-title">${escapeHtml(art.title)}</span>
                        <div class="top-view-meta">
                            <span class="top-view-cat">${cat.emoji || '📖'} ${escapeHtml(cat.name)}</span>
                            <span>👁️ ${art.views} lượt xem</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.top-view-item').forEach(item => {
            item.addEventListener('click', () => {
                openArticleDetailView(item.dataset.id);
            });
        });
    }

    function renderHomePage() {
        renderHomeStats();
        renderTopViewsWidget();
        renderFeaturedPost();
        renderCategoryGrid();
        renderHomeArticlesGrid(searchHomeInput ? searchHomeInput.value.trim() : '');
    }

    function openCategoryView(catId, pushHistory = true) {
        currentCategoryId = catId;
        const cat = categories.find(c => String(c.id) === String(catId)) || { name: 'Chủ đề', emoji: '📖' };

        $('#cat-badge-emoji').textContent = cat.emoji || '📖';
        $('#cat-title-name').textContent = cat.name;

        renderCategoryArticles();
        showView('view-category-articles');

        if (pushHistory) {
            navigateTo({ view: 'category', catId }, true);
        }
    }

    function renderCategoryArticles(filter = '') {
        const cat = categories.find(c => String(c.id) === String(currentCategoryId));
        const filtered = articles.filter(a => {
            const matchesCat = String(a.topic_id) === String(currentCategoryId) || String(a.category_id) === String(currentCategoryId) || (cat && a.category_name === cat.name);
            const matchesFilter = !filter || a.title.toLowerCase().includes(filter.toLowerCase()) || (a.content && a.content.toLowerCase().includes(filter.toLowerCase()));
            return matchesCat && matchesFilter;
        });

        if (filtered.length === 0) {
            articlesGrid.innerHTML = '';
            emptyArticles.style.display = 'block';
            return;
        }

        emptyArticles.style.display = 'none';
        articlesGrid.innerHTML = filtered.map(art => {
            const tags = Array.isArray(art.tags) ? art.tags : (art.tags ? art.tags.split(',') : []);
            const excerpt = art.content ? art.content.replace(/[#*`]/g, '').slice(0, 100) + '...' : 'Không có xem trước';
            const readTime = calcReadTime(art.content);
            const commentCount = comments.filter(c => String(c.entry_id) === String(art.id) || String(c.article_id) === String(art.id)).length;

            return `
                <div class="article-card" data-id="${art.id}">
                    <div>
                        <div class="card-top-meta">
                            <span>📝 Bài viết</span>
                        </div>
                        <h3 class="article-card-title" style="margin-top:0.5rem;">${escapeHtml(art.title)}</h3>
                        <p class="article-card-excerpt" style="margin-top:0.4rem;">${escapeHtml(excerpt)}</p>
                    </div>
                    <div>
                        ${tags.length ? `
                            <div class="article-card-tags" style="margin-bottom:0.75rem;">
                                ${tags.map(t => `<span class="tag-chip">${escapeHtml(t.trim())}</span>`).join('')}
                            </div>
                        ` : ''}
                        <div class="card-bottom-bar">
                            <span>⏱️ ${readTime} phút đọc</span>
                            <span>💬 ${commentCount} bình luận</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        articlesGrid.querySelectorAll('.article-card').forEach(card => {
            card.addEventListener('click', () => {
                openArticleDetailView(card.dataset.id);
            });
        });
    }

    // ============================================================
    //  SCREEN 3: FULL ARTICLE READER VIEW
    // ============================================================

    function openArticleDetailView(artId, pushHistory = true) {
        currentArticleId = artId;
        const art = articles.find(a => String(a.id) === String(artId));
        if (!art) return;

        // Auto sync currentCategoryId so Back button opens this article's category
        const cat = categories.find(c => String(c.id) === String(art.topic_id) || String(c.id) === String(art.category_id) || c.name === art.category_name);
        if (cat) {
            currentCategoryId = cat.id;
        } else if (art.topic_id) {
            currentCategoryId = art.topic_id;
        } else if (art.category_id) {
            currentCategoryId = art.category_id;
        }

        const catObj = cat || { name: art.category_name || 'Chủ đề', emoji: '📖' };
        const readTime = calcReadTime(art.content);

        $('#reader-cat-badge').textContent = `${catObj.emoji || '📖'} ${catObj.name}`;
        $('#reader-date').textContent = formatDate(art.created_at);
        if ($('#reader-read-time')) $('#reader-read-time').textContent = `⏱️ ${readTime} phút đọc`;
        $('#reader-title').textContent = art.title;

        // Increment View Count
        viewsMap[artId] = (viewsMap[artId] || 0) + 1;
        saveLocalViews(viewsMap);

        // Pinned state UI
        const pinBtn = $('#btn-pin-current-article');
        if (pinBtn) {
            if (art.is_pinned) {
                pinBtn.classList.add('pinned');
                if ($('#pin-btn-text')) $('#pin-btn-text').textContent = 'Đã nổi bật';
            } else {
                pinBtn.classList.remove('pinned');
                if ($('#pin-btn-text')) $('#pin-btn-text').textContent = 'Nổi bật';
            }
        }

        // Likes
        const likes = likesMap[artId] || 0;
        if ($('#like-count')) $('#like-count').textContent = likes;

        // Tags
        const tags = Array.isArray(art.tags) ? art.tags : (art.tags ? art.tags.split(',') : []);
        const tagsRow = $('#reader-tags');
        if (tags.length) {
            tagsRow.style.display = 'flex';
            tagsRow.innerHTML = tags.map(t => `<span class="tag-chip">${escapeHtml(t.trim())}</span>`).join('');
        } else {
            tagsRow.style.display = 'none';
        }

        // Full Rendered Content
        $('#reader-content').innerHTML = renderMarkdown(art.content || 'Nội dung bài viết trống.');

        // Render Comments for this article
        renderArticleComments(artId);

        showView('view-article-detail');

        if (pushHistory) {
            navigateTo({ view: 'article', artId }, true);
        }
    }

    // Toggle Pin Action
    async function togglePinCurrentArticle() {
        if (!currentArticleId) return;
        const art = articles.find(a => String(a.id) === String(currentArticleId));
        if (!art) return;

        const currentlyPinnedCount = articles.filter(a => a.is_pinned && String(a.id) !== String(currentArticleId)).length;

        if (!art.is_pinned && currentlyPinnedCount >= 3) {
            showToast('Tối đa 3 bài viết được chọn Nổi Bật! Vui lòng bỏ bớt bài khác trước.');
            return;
        }

        art.is_pinned = !art.is_pinned;
        saveLocalArticles(articles);

        try {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentArticleId);
            if (isUuid) {
                await supabase.from('entries').update({ is_pinned: art.is_pinned }).eq('id', currentArticleId);
            }
        } catch (e) {}

        openArticleDetailView(currentArticleId);
        renderHomePage();
        showToast(art.is_pinned ? '🔥 Đã thêm bài viết vào danh sách Nổi Bật!' : 'Đã bỏ bài viết khỏi danh sách Nổi Bật!');
    }

    $('#btn-pin-current-article')?.addEventListener('click', togglePinCurrentArticle);

    // Toggle Like Action
    $('#btn-like-article')?.addEventListener('click', () => {
        if (!currentArticleId) return;
        const currentLikes = likesMap[currentArticleId] || 0;
        likesMap[currentArticleId] = currentLikes + 1;
        saveLocalLikes(likesMap);
        if ($('#like-count')) $('#like-count').textContent = likesMap[currentArticleId];
        $('#btn-like-article').classList.add('liked');
        showToast('Cảm ơn bạn đã thích bài viết này! ❤️');
    });

    // ============================================================
    //  COMMENT SYSTEM LOGIC
    // ============================================================

    function renderArticleComments(artId) {
        const filteredComments = comments.filter(c => String(c.entry_id) === String(artId) || String(c.article_id) === String(artId));
        
        const countBadge = $('#comment-count-badge');
        if (countBadge) countBadge.textContent = `(${filteredComments.length})`;

        const container = $('#comments-list');
        if (!container) return;

        if (filteredComments.length === 0) {
            container.innerHTML = `<div class="empty-comments">💬 Chưa có bình luận nào. Hãy là người đầu tiên bình luận!</div>`;
            return;
        }

        container.innerHTML = filteredComments.map(cmt => {
            const author = cmt.author_name || 'Khách';
            const initial = author.charAt(0).toUpperCase();
            return `
                <div class="comment-card" data-id="${cmt.id}">
                    <div class="comment-avatar">${escapeHtml(initial)}</div>
                    <div class="comment-main">
                        <div class="comment-top-meta">
                            <span class="comment-author">${escapeHtml(author)}</span>
                            <div style="display:flex;align-items:center;gap:0.5rem;">
                                <span class="comment-date">${formatDate(cmt.created_at)}</span>
                                <button type="button" class="btn-delete-comment" data-id="${cmt.id}" title="Xóa bình luận">🗑️</button>
                            </div>
                        </div>
                        <div class="comment-body">${escapeHtml(cmt.content)}</div>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.btn-delete-comment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteComment(btn.dataset.id);
            });
        });
    }

    async function submitComment() {
        if (!currentArticleId) return;

        const authorInput = $('#comment-author-name');
        const contentInput = $('#comment-content-input');

        const author_name = authorInput.value.trim() || 'Khách';
        const content = contentInput.value.trim();

        if (!content) {
            showToast('Vui lòng nhập nội dung bình luận!');
            return;
        }

        const newComment = {
            id: 'cmt-' + Date.now(),
            entry_id: currentArticleId,
            article_id: currentArticleId,
            author_name,
            content,
            created_at: new Date().toISOString()
        };

        comments.unshift(newComment);
        saveLocalComments(comments);

        try {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentArticleId);
            if (isUuid) {
                const { data } = await supabase.from('comments').insert([{
                    entry_id: currentArticleId,
                    author_name,
                    content
                }]).select();
                if (data && data[0]) {
                    newComment.id = data[0].id;
                    saveLocalComments(comments);
                }
            }
        } catch (e) {
            console.warn('Supabase comment insert exception:', e);
        }

        contentInput.value = '';
        renderArticleComments(currentArticleId);
        renderHomeStats();
        showToast('Đã gửi bình luận thành công!');
    }

    async function deleteComment(cmtId) {
        comments = comments.filter(c => String(c.id) !== String(cmtId));
        saveLocalComments(comments);

        try {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cmtId);
            if (isUuid) {
                await supabase.from('comments').delete().eq('id', cmtId);
            }
        } catch (e) {}

        renderArticleComments(currentArticleId);
        renderHomeStats();
        showToast('Đã xóa bình luận!');
    }

    // ============================================================
    //  MODAL & POST CREATION LOGIC
    // ============================================================

    function openAddArticleModal(preSelectedCatId = null) {
        editingArticleId = null;
        $('#modal-article-title').textContent = 'Tạo bài viết mới';
        $('#post-title').value = '';
        $('#post-content').value = '';
        $('#post-tags').value = '';
        $('#new-cat-box').style.display = 'none';
        $('#new-cat-name').value = '';

        // Populate Categories select
        const select = $('#post-category-select');
        const targetSelected = preSelectedCatId || currentCategoryId;
        select.innerHTML = categories.map(c => `
            <option value="${c.id}" ${String(c.id) === String(targetSelected) ? 'selected' : ''}>
                ${c.emoji || '📖'} ${escapeHtml(c.name)}
            </option>
        `).join('');

        openModal(modalArticle);
    }

    function openEditArticleModal(artId) {
        const art = articles.find(a => String(a.id) === String(artId));
        if (!art) return;

        editingArticleId = artId;
        $('#modal-article-title').textContent = 'Sửa bài viết';
        $('#post-title').value = art.title || '';
        $('#post-content').value = art.content || '';
        $('#post-tags').value = Array.isArray(art.tags) ? art.tags.join(', ') : (art.tags || '');
        $('#new-cat-box').style.display = 'none';

        const select = $('#post-category-select');
        select.innerHTML = categories.map(c => `
            <option value="${c.id}" ${String(c.id) === String(art.topic_id || art.category_id) ? 'selected' : ''}>
                ${c.emoji || '📖'} ${escapeHtml(c.name)}
            </option>
        `).join('');

        openModal(modalArticle);
    }

    async function saveArticle() {
        const title = $('#post-title').value.trim();
        const content = $('#post-content').value.trim();
        const tagsInput = $('#post-tags').value.trim();
        const isNewCat = $('#new-cat-box').style.display === 'block';

        if (!title) {
            showToast('Vui lòng nhập tiêu đề bài viết!');
            return;
        }

        let catId = $('#post-category-select').value;
        let catName = '';

        if (!catId && !isNewCat) {
            if (categories.length > 0) {
                catId = categories[0].id;
            } else {
                showToast('Vui lòng chọn hoặc thêm một thể loại mới!');
                $('#new-cat-box').style.display = 'block';
                return;
            }
        }

        // Handled New Category Creation
        if (isNewCat) {
            const newCatName = $('#new-cat-name').value.trim();
            const newCatEmoji = $('#new-cat-emoji').value || '📖';

            if (!newCatName) {
                showToast('Vui lòng nhập tên thể loại mới!');
                return;
            }

            catId = 'cat-' + Date.now();
            catName = newCatName;

            const newCat = {
                id: catId,
                name: newCatName,
                emoji: newCatEmoji,
                color: '#7C8B76',
                created_at: new Date().toISOString()
            };

            categories.push(newCat);
            saveLocalCategories(categories);

            try {
                const { data } = await supabase.from('topics').insert([{
                    name: newCatName,
                    emoji: newCatEmoji,
                    color: '#7C8B76'
                }]).select();
                if (data && data[0]) {
                    newCat.id = data[0].id;
                    catId = data[0].id;
                    saveLocalCategories(categories);
                }
            } catch (e) { console.warn('Supabase insert topic exception:', e); }
        } else {
            const selectedCat = categories.find(c => String(c.id) === String(catId));
            if (selectedCat) catName = selectedCat.name;
        }

        const tagsArray = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];

        if (editingArticleId) {
            // Update Article
            const idx = articles.findIndex(a => String(a.id) === String(editingArticleId));
            if (idx !== -1) {
                articles[idx].title = title;
                articles[idx].content = content;
                articles[idx].tags = tagsArray;
                articles[idx].topic_id = catId;
                articles[idx].category_id = catId;
                articles[idx].category_name = catName;
                saveLocalArticles(articles);

                try {
                    await supabase.from('entries').update({
                        title, content, tags: tagsArray, topic_id: catId
                    }).eq('id', editingArticleId);
                } catch (e) {}
            }
            showToast('Đã cập nhật bài viết thành công!');
        } else {
            // Create New Article
            const newArt = {
                id: 'art-' + Date.now(),
                topic_id: catId,
                category_id: catId,
                category_name: catName,
                title,
                content,
                tags: tagsArray,
                created_at: new Date().toISOString()
            };

            articles.unshift(newArt);
            saveLocalArticles(articles);

            try {
                const { data } = await supabase.from('entries').insert([{
                    topic_id: catId,
                    title, content, tags: tagsArray
                }]).select();
                if (data && data[0]) {
                    newArt.id = data[0].id;
                    saveLocalArticles(articles);
                }
            } catch (e) {}

            showToast('Đã tạo bài viết mới thành công!');
        }

        closeModal(modalArticle);
        renderHomePage();

        if (String(currentCategoryId) === String(catId)) {
            renderCategoryArticles();
        }

        if (editingArticleId) {
            openArticleDetailView(editingArticleId);
        } else {
            openCategoryView(catId);
        }
    }

    async function deleteCurrentArticle() {
        if (!currentArticleId) return;

        articles = articles.filter(a => String(a.id) !== String(currentArticleId));
        saveLocalArticles(articles);

        try {
            await supabase.from('entries').delete().eq('id', currentArticleId);
        } catch (e) {}

        showToast('Đã xóa bài viết thành công!');
        renderHomePage();
        openCategoryView(currentCategoryId);
    }

    async function deleteCurrentCategory() {
        const targetCatId = editingCategoryId || currentCategoryId;
        const cat = categories.find(c => String(c.id) === String(targetCatId));
        const catName = cat ? cat.name : $('#cat-title-name').textContent;
        const actualId = cat ? cat.id : targetCatId;

        categories = categories.filter(c => String(c.id) !== String(actualId) && c.name !== catName);
        saveLocalCategories(categories);

        articles = articles.filter(a => String(a.topic_id) !== String(actualId) && String(a.category_id) !== String(actualId) && a.category_name !== catName);
        saveLocalArticles(articles);

        try {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actualId);
            if (isUuid) {
                await supabase.from('topics').delete().eq('id', actualId);
                await supabase.from('entries').delete().eq('topic_id', actualId);
            } else {
                await supabase.from('topics').delete().eq('name', catName);
            }
        } catch (e) {}

        showToast(`Đã xóa chủ đề "${catName}" thành công!`);
        renderHomePage();
        showView('view-home');
    }

    // ============================================================
    //  CATEGORY MANAGEMENT & EDITING MODALS
    // ============================================================

    function openCategoryManageModal() {
        const cat = categories.find(c => String(c.id) === String(currentCategoryId));
        const titleName = cat ? cat.name : $('#cat-title-name').textContent;
        $('#cat-manage-title').textContent = `Tùy chọn: ${titleName}`;
        openModal(modalCatManage);
    }

    function openEditCategoryModal(catId = null) {
        editingCategoryId = catId || currentCategoryId;
        const cat = categories.find(c => String(c.id) === String(editingCategoryId));
        if (!cat) return;

        $('#edit-cat-name').value = cat.name || '';
        $('#edit-cat-emoji-value').value = cat.emoji || '📖';

        const targetEmoji = cat.emoji || '📖';
        $$('#edit-cat-emoji-picker .emoji-option').forEach(b => {
            if (b.dataset.emoji === targetEmoji) {
                b.classList.add('selected');
            } else {
                b.classList.remove('selected');
            }
        });

        openModal(modalEditCat);
    }

    async function saveEditCategory() {
        const newCatName = $('#edit-cat-name').value.trim();
        const newCatEmoji = $('#edit-cat-emoji-value').value || '📖';

        if (!newCatName) {
            showToast('Vui lòng nhập tên chủ đề!');
            return;
        }

        const targetCatId = editingCategoryId || currentCategoryId;
        let idx = categories.findIndex(c => String(c.id) === String(targetCatId));

        if (idx !== -1) {
            const oldName = categories[idx].name;
            categories[idx].name = newCatName;
            categories[idx].emoji = newCatEmoji;
            saveLocalCategories(categories);

            // Update matching articles
            articles.forEach(a => {
                if (String(a.topic_id) === String(targetCatId) || String(a.category_id) === String(targetCatId) || a.category_name === oldName) {
                    a.category_name = newCatName;
                }
            });
            saveLocalArticles(articles);

            // Update Supabase
            try {
                const catObj = categories[idx];
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(catObj.id);
                if (isUuid) {
                    await supabase.from('topics').update({
                        name: newCatName,
                        emoji: newCatEmoji
                    }).eq('id', catObj.id);
                } else {
                    // Update by name or create record
                    const { data: dbCats } = await supabase.from('topics').select('id').eq('name', oldName);
                    if (dbCats && dbCats.length > 0) {
                        await supabase.from('topics').update({
                            name: newCatName,
                            emoji: newCatEmoji
                        }).eq('id', dbCats[0].id);
                    } else {
                        const { data: newDbCats } = await supabase.from('topics').insert([{
                            name: newCatName,
                            emoji: newCatEmoji,
                            color: '#7C8B76'
                        }]).select();
                        if (newDbCats && newDbCats[0]) {
                            categories[idx].id = newDbCats[0].id;
                            saveLocalCategories(categories);
                        }
                    }
                }
            } catch (e) {
                console.warn('Supabase update topic exception:', e);
            }
        }

        // Refresh UI
        if (String(currentCategoryId) === String(targetCatId)) {
            $('#cat-badge-emoji').textContent = newCatEmoji;
            $('#cat-title-name').textContent = newCatName;
            renderCategoryArticles();
        }

        renderHomePage();
        showToast('Cập nhật chủ đề thành công!');
        closeModal(modalEditCat);
    }

    // Modal Helpers
    function openModal(modalOrId) {
        const modal = typeof modalOrId === 'string' ? $(`#${modalOrId}`) : modalOrId;
        if (modal) {
            modal.classList.add('show');
            setTimeout(() => {
                const inp = modal.querySelector('input[type="text"], textarea');
                if (inp) inp.focus();
            }, 100);
        }
    }

    function closeModal(modalOrId) {
        const modal = typeof modalOrId === 'string' ? $(`#${modalOrId}`) : modalOrId;
        if (modal) modal.classList.remove('show');
    }

    $$('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.getAttribute('data-close')));
    });

    // Close modals on overlay background click
    $$('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(overlay);
        });
    });

    // ============================================================
    //  WORD-STYLE EDITOR TOOLBAR & TEXT FORMATTING
    // ============================================================

    function applyTextFormat(action) {
        const textarea = $('#post-content');
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        let replacement = '';
        let cursorOffset = 0;

        switch (action) {
            case 'uppercase':
                replacement = selectedText ? selectedText.toUpperCase() : '';
                break;
            case 'lowercase':
                replacement = selectedText ? selectedText.toLowerCase() : '';
                break;
            case 'titlecase':
                replacement = selectedText ? selectedText.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()) : '';
                break;
            case 'bold':
                replacement = selectedText ? `**${selectedText}**` : '**In đậm**';
                cursorOffset = selectedText ? 0 : -2;
                break;
            case 'italic':
                replacement = selectedText ? `*${selectedText}*` : '*In nghiêng*';
                cursorOffset = selectedText ? 0 : -1;
                break;
            case 'underline':
                replacement = selectedText ? `<u>${selectedText}</u>` : '<u>Gạch chân</u>';
                cursorOffset = selectedText ? 0 : -4;
                break;
            case 'strikethrough':
                replacement = selectedText ? `~~${selectedText}~~` : '~~Gạch ngang~~';
                cursorOffset = selectedText ? 0 : -2;
                break;
            case 'h1':
                replacement = selectedText ? `# ${selectedText}` : '# Tiêu đề 1\n';
                break;
            case 'h2':
                replacement = selectedText ? `## ${selectedText}` : '## Tiêu đề 2\n';
                break;
            case 'h3':
                replacement = selectedText ? `### ${selectedText}` : '### Tiêu đề 3\n';
                break;
            case 'ul':
                replacement = selectedText ? selectedText.split('\n').map(l => `- ${l}`).join('\n') : '- Danh sách\n';
                break;
            case 'ol':
                replacement = selectedText ? selectedText.split('\n').map((l, i) => `${i+1}. ${l}`).join('\n') : '1. Danh sách\n';
                break;
            case 'quote':
                replacement = selectedText ? `> ${selectedText}` : '> Trích dẫn\n';
                break;
            case 'code':
                replacement = selectedText ? `\`\`\`\n${selectedText}\n\`\`\`` : '```\n// Code ở đây\n```';
                break;
        }

        if (replacement) {
            textarea.setRangeText(replacement, start, end, 'select');
            textarea.focus();
            if (cursorOffset !== 0) {
                const newPos = start + replacement.length + cursorOffset;
                textarea.setSelectionRange(newPos, newPos);
            }
        }
    }

    // Attach Toolbar Button Click Handlers
    $$('#editor-toolbar .tb-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const action = btn.dataset.action;
            if (action) applyTextFormat(action);
        });
    });

    // Keyboard Shortcuts inside Editor Textarea (Ctrl+B, Ctrl+I, Ctrl+U)
    $('#post-content')?.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            const key = e.key.toLowerCase();
            if (key === 'b') { e.preventDefault(); applyTextFormat('bold'); }
            else if (key === 'i') { e.preventDefault(); applyTextFormat('italic'); }
            else if (key === 'u') { e.preventDefault(); applyTextFormat('underline'); }
        }
    });

    // ============================================================
    //  EVENT LISTENERS & BINDINGS
    // ============================================================

    // Navigation bar links
    $('#nav-brand-logo')?.addEventListener('click', (e) => {
        e.preventDefault();
        showView('view-home');
    });

    $('#nav-item-home')?.addEventListener('click', () => {
        showView('view-home');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    $('#nav-item-categories')?.addEventListener('click', () => {
        renderAllCategoriesPage();
        showView('view-all-categories');
    });

    $('#btn-back-home-from-all-cats')?.addEventListener('click', () => {
        showView('view-home');
    });

    $('#btn-add-cat-from-all')?.addEventListener('click', () => {
        openAddArticleModal();
        $('#new-cat-box').style.display = 'block';
    });

    // Toggle new category box inside modal
    $('#btn-toggle-new-cat')?.addEventListener('click', () => {
        const box = $('#new-cat-box');
        if (box) {
            const isHidden = box.style.display === 'none';
            box.style.display = isHidden ? 'block' : 'none';
            if (isHidden) $('#new-cat-name')?.focus();
        }
    });

    // Emoji picker inside Add Article Modal
    $$('#emoji-picker .emoji-option').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('#emoji-picker .emoji-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            const hiddenVal = $('#new-cat-emoji');
            if (hiddenVal) hiddenVal.value = btn.dataset.emoji;
        });
    });

    // Emoji picker inside Edit Category Modal
    $$('#edit-cat-emoji-picker .emoji-option').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('#edit-cat-emoji-picker .emoji-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            const hiddenVal = $('#edit-cat-emoji-value');
            if (hiddenVal) hiddenVal.value = btn.dataset.emoji;
        });
    });

    // Top Nav Menu Items & Landing Page Action Buttons
    $('#nav-item-landing')?.addEventListener('click', () => {
        navigateTo({ view: 'landing' });
        renderLandingPage();
        showView('view-landing');
    });

    $('#nav-item-home')?.addEventListener('click', () => {
        navigateTo({ view: 'home' });
        renderHomePage();
        showView('view-home');
    });

    $('#nav-item-categories')?.addEventListener('click', () => {
        navigateTo({ view: 'all-categories' });
        renderAllCategoriesPage();
        showView('view-all-categories');
    });

    $('#btn-enter-app-hero')?.addEventListener('click', () => {
        navigateTo({ view: 'home' });
        renderHomePage();
        showView('view-home');
    });

    $('#btn-enter-app-bottom')?.addEventListener('click', () => {
        navigateTo({ view: 'home' });
        renderHomePage();
        showView('view-home');
    });

    $('#btn-create-post-landing')?.addEventListener('click', () => {
        openAddArticleModal();
    });

    // Home create post button
    $('#btn-create-post')?.addEventListener('click', () => openAddArticleModal());
    $('#btn-create-post-secondary')?.addEventListener('click', () => openAddArticleModal());
    $('#btn-see-all-cats-sidebar')?.addEventListener('click', () => {
        renderAllCategoriesPage();
        showView('view-all-categories');
    });
    $('#btn-add-article-in-cat')?.addEventListener('click', () => openAddArticleModal(currentCategoryId));
    $('#btn-add-first-article')?.addEventListener('click', () => openAddArticleModal(currentCategoryId));
    $('#btn-save-article')?.addEventListener('click', saveArticle);

    // Article actions inside Reader View
    $('#btn-edit-current-article')?.addEventListener('click', () => openEditArticleModal(currentArticleId));
    $('#btn-delete-current-article')?.addEventListener('click', () => {
        if ($('#confirm-message')) $('#confirm-message').textContent = 'Bạn có chắc chắn muốn xóa bài viết này?';
        deleteAction = deleteCurrentArticle;
        openModal(modalConfirm);
    });

    // Category Header Title click event delegation (Opens manage options modal)
    document.addEventListener('click', (e) => {
        const titleBtn = e.target.closest('#cat-header-title-btn');
        if (titleBtn) {
            e.preventDefault();
            e.stopPropagation();
            openCategoryManageModal();
        }
    });

    // Choices inside Category Manage Modal
    $('#btn-choice-edit-cat')?.addEventListener('click', () => {
        closeModal(modalCatManage);
        openEditCategoryModal(currentCategoryId);
    });

    $('#btn-choice-delete-cat')?.addEventListener('click', () => {
        closeModal(modalCatManage);
        const cat = categories.find(c => String(c.id) === String(currentCategoryId));
        const catName = cat ? cat.name : $('#cat-title-name').textContent;
        if ($('#confirm-message')) {
            $('#confirm-message').textContent = `Bạn có chắc chắn muốn xóa chủ đề "${catName}" và tất cả bài viết thuộc về nó?`;
        }
        deleteAction = deleteCurrentCategory;
        openModal(modalConfirm);
    });

    // Save edited category
    $('#btn-save-edit-cat')?.addEventListener('click', saveEditCategory);

    // Delete category inside modal
    $('#btn-delete-cat-in-modal')?.addEventListener('click', () => {
        closeModal(modalEditCat);
        const cat = categories.find(c => String(c.id) === String(editingCategoryId || currentCategoryId));
        const catName = cat ? cat.name : $('#cat-title-name').textContent;
        if ($('#confirm-message')) {
            $('#confirm-message').textContent = `Bạn có chắc chắn muốn xóa chủ đề "${catName}" và tất cả bài viết thuộc về nó?`;
        }
        deleteAction = deleteCurrentCategory;
        openModal(modalConfirm);
    });

    // Confirm Delete button
    $('#btn-confirm-delete')?.addEventListener('click', async () => {
        if (deleteAction) { await deleteAction(); deleteAction = null; }
        closeModal(modalConfirm);
    });

    // ============================================================
    //  SPA ROUTER & HISTORY BACK MANAGEMENT
    // ============================================================

    function navigateTo(routeState, push = true) {
        let hash = '#landing';
        if (routeState.view === 'home') {
            hash = `#home`;
        } else if (routeState.view === 'category' && routeState.catId) {
            hash = `#category/${routeState.catId}`;
        } else if (routeState.view === 'article' && routeState.artId) {
            hash = `#article/${routeState.artId}`;
        } else if (routeState.view === 'all-categories') {
            hash = `#categories`;
        }

        if (push && window.location.hash !== hash) {
            history.pushState(routeState, '', hash);
        }
    }

    function applyRouteState(routeState) {
        const { view, catId, artId } = routeState || {};
        if (view === 'home') {
            renderHomePage();
            showView('view-home');
        } else if (view === 'category' && catId) {
            openCategoryView(catId, false);
        } else if (view === 'article' && artId) {
            openArticleDetailView(artId, false);
        } else if (view === 'all-categories') {
            renderAllCategoriesPage();
            showView('view-all-categories');
        } else {
            renderLandingPage();
            showView('view-landing');
        }
    }

    window.addEventListener('popstate', (e) => {
        if (e.state) {
            applyRouteState(e.state);
        } else {
            parseHashAndNavigate();
        }
    });

    function parseHashAndNavigate() {
        const hash = window.location.hash;
        if (hash === '#home') {
            applyRouteState({ view: 'home' });
        } else if (hash.startsWith('#category/')) {
            const catId = hash.replace('#category/', '');
            applyRouteState({ view: 'category', catId });
        } else if (hash.startsWith('#article/')) {
            const artId = hash.replace('#article/', '');
            applyRouteState({ view: 'article', artId });
        } else if (hash === '#categories') {
            applyRouteState({ view: 'all-categories' });
        } else {
            applyRouteState({ view: 'landing' });
        }
    }

    // Navigation Back buttons
    $('#btn-back-home')?.addEventListener('click', () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            navigateTo({ view: 'home' });
            renderHomePage();
            showView('view-home');
        }
    });

    $('#btn-back-cat-articles')?.addEventListener('click', () => {
        if (window.history.length > 1) {
            window.history.back();
        } else if (currentCategoryId) {
            openCategoryView(currentCategoryId, false);
        } else {
            navigateTo({ view: 'home' });
            renderHomePage();
            showView('view-home');
        }
    });

    $('#btn-back-home-from-all-cats')?.addEventListener('click', () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            navigateTo({ view: 'home' });
            renderHomePage();
            showView('view-home');
        }
    });

    // Comment Submit Button Handler
    $('#btn-submit-comment')?.addEventListener('click', submitComment);

    // Nav Dropdown Toggle Handler (Click to open/close)
    $$('.nav-dropdown-trigger').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wrapper = btn.closest('.nav-dropdown-wrapper');
            const isOpen = wrapper ? wrapper.classList.contains('is-open') : false;

            // Close any other open dropdowns
            $$('.nav-dropdown-wrapper.is-open').forEach(w => w.classList.remove('is-open'));

            if (wrapper && !isOpen) {
                wrapper.classList.add('is-open');
            }
        });
    });

    // Click outside to close open dropdowns
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-dropdown-wrapper')) {
            $$('.nav-dropdown-wrapper.is-open').forEach(w => w.classList.remove('is-open'));
        }
    });

    // Search inputs
    let searchDebounce = null;
    if (searchCatInput) {
        searchCatInput.addEventListener('input', () => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                renderCategoryArticles(searchCatInput.value.trim());
            }, 200);
        });
    }

    if (searchHomeInput) {
        searchHomeInput.addEventListener('input', () => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                renderHomeArticlesGrid(searchHomeInput.value.trim());
            }, 200);
        });
    }

    // ============================================================
    //  INIT
    // ============================================================

    async function init() {
        // Fit cứng luôn luôn mở trang Giới thiệu (view-landing) ngay lập tức khi vừa tải trang (0ms trễ)
        window.location.hash = '#landing';
        showView('view-landing');
        renderLandingPage();
        setTimeout(updateNavPillPosition, 50);

        // Tải dữ liệu đám mây Supabase ở nền sau
        await fetchAllData();
        renderLandingPage();
    }

    init();
})();
