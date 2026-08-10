/* ============================================
   EMIR KNOWLEDGE LAB — Application Logic
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
    let currentCategoryId = null;
    let currentArticleId = null;
    let editingArticleId = null;
    let editingCategoryId = null;
    let deleteAction = null;

    // DOM Elements
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const viewHome = $('#view-home');
    const viewCategoryArticles = $('#view-category-articles');
    const viewArticleDetail = $('#view-article-detail');

    const categoriesGrid = $('#categories-grid');
    const articlesGrid = $('#articles-grid');
    const emptyArticles = $('#empty-articles');
    const searchCatInput = $('#search-cat-input');

    const modalArticle = $('#modal-article');
    const modalConfirm = $('#modal-confirm');
    const modalEditCat = $('#modal-edit-cat');
    const modalCatManage = $('#modal-cat-manage');

    // Utility
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

    function renderMarkdown(content) {
        if (!content) return '';
        let html = escapeHtml(content);
        // Code block
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Bold
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // Italic
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        // Line breaks to paragraphs
        const paragraphs = html.split(/\n\n+/);
        return paragraphs.map(p => {
            if (p.startsWith('<h') || p.startsWith('<pre')) return p;
            return `<p>${p.replace(/\n/g, '<br>')}</p>`;
        }).join('');
    }

    function showToast(msg) {
        const container = $('#toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    // Navigation Switcher
    function showView(viewId) {
        [viewHome, viewCategoryArticles, viewArticleDetail].forEach(v => v.classList.remove('active'));
        $(`#${viewId}`).classList.add('active');
        window.scrollTo(0, 0);
    }

    // ============================================================
    //  SUPABASE / LOCAL STORAGE DATA
    // ============================================================

    function getLocalCategories() {
        try {
            const raw = localStorage.getItem('emir_categories');
            return raw ? JSON.parse(raw) : DEFAULT_CATEGORIES;
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

    async function fetchAllData() {
        categories = getLocalCategories();
        articles = getLocalArticles();

        try {
            const { data: catData, error: catErr } = await supabase.from('topics').select('*');
            if (!catErr && catData && catData.length > 0) {
                // Merge with default categories
                const map = new Map();
                DEFAULT_CATEGORIES.forEach(c => map.set(c.name.toLowerCase(), c));
                catData.forEach(c => map.set(c.name.toLowerCase(), c));
                categories = Array.from(map.values());
                saveLocalCategories(categories);
            }

            const { data: artData, error: artErr } = await supabase.from('entries').select('*');
            if (!artErr && artData && artData.length > 0) {
                articles = artData;
                saveLocalArticles(articles);
            }
        } catch (e) {
            console.warn('Supabase fetch exception, using local fallback:', e);
        }
    }

    // ============================================================
    //  SCREEN 1: HOME — CATEGORY PILL BUTTONS (WITH EDIT ACTIONS)
    // ============================================================

    function renderCategoryGrid() {
        categoriesGrid.innerHTML = categories.map(cat => {
            const count = articles.filter(a => String(a.topic_id) === String(cat.id) || String(a.category_id) === String(cat.id) || a.category_name === cat.name).length;
            return `
                <button class="cat-pill-btn" data-id="${cat.id}">
                    <div class="cat-icon-circle">${cat.emoji || '📖'}</div>
                    <span>${escapeHtml(cat.name)}</span>
                    ${count > 0 ? `<span style="font-size:0.75rem;opacity:0.6;font-weight:600;">(${count})</span>` : ''}
                </button>
            `;
        }).join('');

        categoriesGrid.querySelectorAll('.cat-pill-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                openCategoryView(btn.dataset.id);
            });
        });
    }

    // ============================================================
    //  SCREEN 2: CATEGORY ARTICLES LIST VIEW
    // ============================================================

    function openCategoryView(catId) {
        currentCategoryId = catId;
        const cat = categories.find(c => String(c.id) === String(catId)) || { name: 'Chủ đề', emoji: '📖' };

        $('#cat-badge-emoji').textContent = cat.emoji || '📖';
        $('#cat-title-name').textContent = cat.name;

        renderCategoryArticles();
        showView('view-category-articles');
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
            return `
                <div class="article-card" data-id="${art.id}">
                    <div class="card-top-meta">
                        <span>📝 Bài viết</span>
                        <span>${formatDate(art.created_at)}</span>
                    </div>
                    <h3 class="article-card-title">${escapeHtml(art.title)}</h3>
                    <p class="article-card-excerpt">${escapeHtml(excerpt)}</p>
                    ${tags.length ? `
                        <div class="article-card-tags">
                            ${tags.map(t => `<span class="tag-chip">${escapeHtml(t.trim())}</span>`).join('')}
                        </div>
                    ` : ''}
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

    function openArticleDetailView(artId) {
        currentArticleId = artId;
        const art = articles.find(a => String(a.id) === String(artId));
        if (!art) return;

        const cat = categories.find(c => String(c.id) === String(art.topic_id) || String(c.id) === String(art.category_id) || c.name === art.category_name) || { name: 'Chủ đề', emoji: '📖' };

        $('#reader-cat-badge').textContent = `${cat.emoji || '📖'} ${cat.name}`;
        $('#reader-date').textContent = formatDate(art.created_at);
        $('#reader-title').textContent = art.title;

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

        showView('view-article-detail');
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
        renderCategoryGrid();

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
        renderCategoryGrid();
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
        renderCategoryGrid();
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

        renderCategoryGrid();
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
    //  EVENT LISTENERS & BINDINGS
    // ============================================================

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

    // Home create post button
    $('#btn-create-post')?.addEventListener('click', () => openAddArticleModal());
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

    // Navigation Back buttons
    $('#btn-back-home')?.addEventListener('click', () => {
        renderCategoryGrid();
        showView('view-home');
    });

    $('#btn-back-cat-articles')?.addEventListener('click', () => {
        openCategoryView(currentCategoryId);
    });

    // Search input inside Category list
    let searchDebounce = null;
    if (searchCatInput) {
        searchCatInput.addEventListener('input', () => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                renderCategoryArticles(searchCatInput.value.trim());
            }, 200);
        });
    }

    // ============================================================
    //  INIT
    // ============================================================

    async function init() {
        await fetchAllData();
        renderCategoryGrid();
        showView('view-home');
    }

    init();
})();
