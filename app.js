/* ============================================
   KHO TÀNG KIẾN THỨC — Application Logic
   Kết nối với Supabase Database
   ============================================ */

(() => {
    'use strict';

    // ---- Supabase Config ----
    const SUPABASE_URL = 'https://nhlxvsgkepaqqnfoqxqb.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5obHh2c2drZXBhcXFuZm9xeHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMjIzOTIsImV4cCI6MjEwMDY5ODM5Mn0.JmRdrrnCyIbkEIbM7aBs2AZ0hKznWdqKAcRCYxs6mBo';

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // ---- State ----
    let topics = [];
    let currentTopicId = null;
    let editingTopicId = null;
    let editingEntryId = null;
    let deleteAction = null;

    // ---- DOM References ----
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const pageHome = $('#page-home');
    const pageDetail = $('#page-detail');
    const topicsGrid = $('#topics-grid');
    const emptyState = $('#empty-state');
    const emptyEntries = $('#empty-entries');
    const entriesList = $('#entries-list');
    const searchInput = $('#search-input');
    const totalTopicsEl = $('#total-topics');
    const totalEntriesEl = $('#total-entries');

    const modalTopic = $('#modal-topic');
    const modalEntry = $('#modal-entry');
    const modalConfirm = $('#modal-confirm');

    // ---- Utility ----
    function formatDate(ts) {
        const d = new Date(ts);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function renderMarkdown(text) {
        let html = escapeHtml(text);
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/^- (.+)$/gm, '• $1');
        return html;
    }

    // ---- Toast ----
    function showToast(message, type = 'success') {
        const container = $('#toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${type === 'success' ? '✅' : '❌'}</span>
            <span>${escapeHtml(message)}</span>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-out');
            toast.addEventListener('animationend', () => toast.remove());
        }, 2500);
    }

    // ---- Loading overlay ----
    function setLoading(show) {
        let loader = $('#global-loader');
        if (show) {
            if (!loader) {
                loader = document.createElement('div');
                loader.id = 'global-loader';
                loader.innerHTML = `
                    <div style="
                        position:fixed;inset:0;z-index:3000;
                        display:flex;align-items:center;justify-content:center;
                        background:rgba(10,10,26,0.6);backdrop-filter:blur(4px);
                    ">
                        <div style="
                            display:flex;flex-direction:column;align-items:center;gap:1rem;
                            padding:2rem 3rem;background:rgba(18,18,42,0.95);
                            border:1px solid rgba(255,255,255,0.08);border-radius:16px;
                            box-shadow:0 20px 60px rgba(0,0,0,0.4);
                        ">
                            <div class="spinner" style="
                                width:36px;height:36px;border:3px solid rgba(108,92,231,0.2);
                                border-top-color:#6C5CE7;border-radius:50%;
                                animation:spin 0.8s linear infinite;
                            "></div>
                            <span style="color:#8888aa;font-size:0.9rem;">Đang tải...</span>
                        </div>
                    </div>
                `;
                document.body.appendChild(loader);
                // Add spin keyframe if not exists
                if (!document.getElementById('spin-style')) {
                    const style = document.createElement('style');
                    style.id = 'spin-style';
                    style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
                    document.head.appendChild(style);
                }
            }
            loader.style.display = 'block';
        } else {
            if (loader) loader.style.display = 'none';
        }
    }

    // ---- Modal Helpers ----
    function openModal(modal) {
        modal.classList.add('show');
        setTimeout(() => {
            const input = modal.querySelector('input[type="text"], textarea');
            if (input) input.focus();
        }, 100);
    }

    function closeModal(modal) {
        modal.classList.remove('show');
    }

    $$('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-close');
            closeModal($(`#${modalId}`));
        });
    });

    [modalTopic, modalEntry, modalConfirm].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            [modalTopic, modalEntry, modalConfirm].forEach(closeModal);
        }
    });

    // ---- Page Navigation ----
    function showPage(pageId) {
        $$('.page').forEach(p => p.classList.remove('active'));
        const page = $(`#${pageId}`);
        page.classList.remove('active');
        void page.offsetWidth;
        page.classList.add('active');
        window.scrollTo(0, 0);
    }

    // ============================================================
    //  SUPABASE DATA OPERATIONS
    // ============================================================

    // ---- Fetch all topics with entry counts ----
    async function fetchTopics() {
        const { data: topicsData, error } = await supabase
            .from('topics')
            .select('*, entries(count)')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Lỗi tải chủ đề:', error);
            showToast('Lỗi kết nối database!', 'error');
            return;
        }

        topics = topicsData.map(t => ({
            ...t,
            entryCount: t.entries?.[0]?.count ?? 0
        }));
    }

    // ---- Fetch entries for a topic ----
    async function fetchEntries(topicId) {
        const { data: entries, error } = await supabase
            .from('entries')
            .select('*')
            .eq('topic_id', topicId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Lỗi tải kiến thức:', error);
            showToast('Lỗi tải kiến thức!', 'error');
            return [];
        }

        return entries || [];
    }

    // ============================================================
    //  RENDER: Home Page
    // ============================================================

    function renderTopics(filter = '') {
        const filtered = topics.filter(t =>
            t.name.toLowerCase().includes(filter.toLowerCase())
        );

        // Stats
        totalTopicsEl.textContent = topics.length;
        const totalEntries = topics.reduce((sum, t) => sum + (t.entryCount || 0), 0);
        totalEntriesEl.textContent = totalEntries;

        if (filtered.length === 0 && filter === '') {
            topicsGrid.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        if (filtered.length === 0) {
            topicsGrid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);">
                    <p style="font-size:2rem;margin-bottom:0.5rem;">🔍</p>
                    <p>Không tìm thấy kết quả cho "${escapeHtml(filter)}"</p>
                </div>
            `;
            return;
        }

        topicsGrid.innerHTML = filtered.map((topic, i) => `
            <div class="topic-card" data-id="${topic.id}" style="--card-color:${topic.color || '#6C5CE7'};animation-delay:${i * 0.05}s">
                <span class="card-emoji">${topic.emoji || '📖'}</span>
                <h3 class="card-title">${escapeHtml(topic.name)}</h3>
                <div class="card-meta">
                    <span class="card-count">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>
                        ${topic.entryCount || 0} bài viết
                    </span>
                    <span class="card-date">${formatDate(topic.created_at)}</span>
                </div>
            </div>
        `).join('');

        topicsGrid.querySelectorAll('.topic-card').forEach(card => {
            card.addEventListener('click', () => openDetailPage(card.dataset.id));
        });
    }

    // ============================================================
    //  RENDER: Detail Page
    // ============================================================

    async function openDetailPage(topicId) {
        currentTopicId = topicId;
        const topic = topics.find(t => t.id === topicId);
        if (!topic) return;

        $('#detail-emoji').textContent = topic.emoji || '📖';
        $('#detail-title').textContent = topic.name;
        document.title = `${topic.emoji || '📖'} ${topic.name} — Kho Tàng Kiến Thức`;

        showPage('page-detail');
        setLoading(true);

        const entries = await fetchEntries(topicId);
        renderEntriesList(entries);

        setLoading(false);
    }

    function renderEntriesList(entries) {
        if (!entries || entries.length === 0) {
            entriesList.innerHTML = '';
            emptyEntries.style.display = 'block';
            return;
        }

        emptyEntries.style.display = 'none';

        entriesList.innerHTML = entries.map((entry, i) => {
            const tags = (entry.tags || []).map(tag =>
                `<span class="entry-tag">#${escapeHtml(tag)}</span>`
            ).join('');

            return `
                <article class="entry-card" data-id="${entry.id}" style="animation-delay:${i * 0.05}s">
                    <div class="entry-header">
                        <h3 class="entry-title">${escapeHtml(entry.title)}</h3>
                        <div class="entry-actions">
                            <button class="btn-icon btn-edit-entry" title="Sửa" data-id="${entry.id}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                                </svg>
                            </button>
                            <button class="btn-icon btn-danger btn-delete-entry" title="Xóa" data-id="${entry.id}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="entry-content">${renderMarkdown(entry.content)}</div>
                    <div class="entry-footer">
                        ${tags}
                        <span class="entry-date">${formatDate(entry.created_at)}</span>
                    </div>
                </article>
            `;
        }).join('');

        // Cache entries for editing
        entriesList._entries = entries;

        entriesList.querySelectorAll('.btn-edit-entry').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditEntryModal(btn.dataset.id);
            });
        });

        entriesList.querySelectorAll('.btn-delete-entry').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                confirmDeleteEntry(btn.dataset.id);
            });
        });
    }

    // ============================================================
    //  TOPIC CRUD (Supabase)
    // ============================================================

    // Emoji picker
    $$('.emoji-option').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.emoji-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            $('#topic-emoji-value').value = btn.dataset.emoji;
        });
    });
    document.querySelector('.emoji-option')?.classList.add('selected');

    // Color picker
    $$('.color-option').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.color-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            $('#topic-color-value').value = btn.dataset.color;
        });
    });
    document.querySelector('.color-option')?.classList.add('selected');

    function openAddTopicModal() {
        editingTopicId = null;
        $('#modal-topic-title').textContent = 'Thêm chủ đề mới';
        $('#topic-name').value = '';
        $$('.emoji-option').forEach(b => b.classList.remove('selected'));
        document.querySelector('.emoji-option')?.classList.add('selected');
        $('#topic-emoji-value').value = '📖';
        $$('.color-option').forEach(b => b.classList.remove('selected'));
        document.querySelector('.color-option')?.classList.add('selected');
        $('#topic-color-value').value = '#6C5CE7';
        openModal(modalTopic);
    }

    function openEditTopicModal() {
        const topic = topics.find(t => t.id === currentTopicId);
        if (!topic) return;

        editingTopicId = currentTopicId;
        $('#modal-topic-title').textContent = 'Sửa chủ đề';
        $('#topic-name').value = topic.name;
        $$('.emoji-option').forEach(b => {
            b.classList.toggle('selected', b.dataset.emoji === topic.emoji);
        });
        $('#topic-emoji-value').value = topic.emoji || '📖';
        $$('.color-option').forEach(b => {
            b.classList.toggle('selected', b.dataset.color === topic.color);
        });
        $('#topic-color-value').value = topic.color || '#6C5CE7';
        openModal(modalTopic);
    }

    async function saveTopic() {
        const name = $('#topic-name').value.trim();
        if (!name) {
            showToast('Vui lòng nhập tên chủ đề', 'error');
            return;
        }

        const emoji = $('#topic-emoji-value').value;
        const color = $('#topic-color-value').value;

        setLoading(true);

        if (editingTopicId) {
            // UPDATE
            const { error } = await supabase
                .from('topics')
                .update({ name, emoji, color })
                .eq('id', editingTopicId);

            if (error) {
                console.error('Lỗi cập nhật:', error);
                showToast('Lỗi cập nhật chủ đề!', 'error');
                setLoading(false);
                return;
            }
            showToast('Đã cập nhật chủ đề!');
            $('#detail-emoji').textContent = emoji;
            $('#detail-title').textContent = name;
        } else {
            // INSERT
            const { error } = await supabase
                .from('topics')
                .insert([{ name, emoji, color }]);

            if (error) {
                console.error('Lỗi thêm:', error);
                showToast('Lỗi thêm chủ đề!', 'error');
                setLoading(false);
                return;
            }
            showToast('Đã thêm chủ đề mới!');
        }

        await fetchTopics();
        renderTopics(searchInput.value);
        closeModal(modalTopic);
        setLoading(false);
    }

    function confirmDeleteTopic() {
        const topic = topics.find(t => t.id === currentTopicId);
        if (!topic) return;

        $('#confirm-message').textContent = `Bạn có chắc muốn xóa chủ đề "${topic.name}" và tất cả kiến thức bên trong?`;
        deleteAction = async () => {
            setLoading(true);
            const { error } = await supabase
                .from('topics')
                .delete()
                .eq('id', currentTopicId);

            if (error) {
                console.error('Lỗi xóa:', error);
                showToast('Lỗi xóa chủ đề!', 'error');
                setLoading(false);
                return;
            }

            showToast('Đã xóa chủ đề!');
            document.title = '📚 Kho Tàng Kiến Thức';
            await fetchTopics();
            showPage('page-home');
            renderTopics(searchInput.value);
            setLoading(false);
        };
        openModal(modalConfirm);
    }

    // ============================================================
    //  ENTRY CRUD (Supabase)
    // ============================================================

    function openAddEntryModal() {
        editingEntryId = null;
        $('#modal-entry-title').textContent = 'Thêm kiến thức mới';
        $('#entry-title').value = '';
        $('#entry-content').value = '';
        $('#entry-tags').value = '';
        openModal(modalEntry);
    }

    function openEditEntryModal(entryId) {
        const entries = entriesList._entries || [];
        const entry = entries.find(e => e.id === entryId);
        if (!entry) return;

        editingEntryId = entryId;
        $('#modal-entry-title').textContent = 'Sửa kiến thức';
        $('#entry-title').value = entry.title;
        $('#entry-content').value = entry.content;
        $('#entry-tags').value = (entry.tags || []).join(', ');
        openModal(modalEntry);
    }

    async function saveEntry() {
        const title = $('#entry-title').value.trim();
        const content = $('#entry-content').value.trim();
        const tagsRaw = $('#entry-tags').value.trim();

        if (!title) {
            showToast('Vui lòng nhập tiêu đề', 'error');
            return;
        }
        if (!content) {
            showToast('Vui lòng nhập nội dung', 'error');
            return;
        }

        const tags = tagsRaw
            ? tagsRaw.split(',').map(t => t.trim()).filter(t => t.length > 0)
            : [];

        setLoading(true);

        if (editingEntryId) {
            // UPDATE
            const { error } = await supabase
                .from('entries')
                .update({ title, content, tags })
                .eq('id', editingEntryId);

            if (error) {
                console.error('Lỗi cập nhật:', error);
                showToast('Lỗi cập nhật kiến thức!', 'error');
                setLoading(false);
                return;
            }
            showToast('Đã cập nhật kiến thức!');
        } else {
            // INSERT
            const { error } = await supabase
                .from('entries')
                .insert([{ topic_id: currentTopicId, title, content, tags }]);

            if (error) {
                console.error('Lỗi thêm:', error);
                showToast('Lỗi thêm kiến thức!', 'error');
                setLoading(false);
                return;
            }
            showToast('Đã thêm kiến thức mới!');
        }

        // Refresh entries
        const entries = await fetchEntries(currentTopicId);
        renderEntriesList(entries);

        // Refresh topic counts
        await fetchTopics();
        renderTopics(searchInput.value);

        closeModal(modalEntry);
        setLoading(false);
    }

    function confirmDeleteEntry(entryId) {
        const entries = entriesList._entries || [];
        const entry = entries.find(e => e.id === entryId);
        if (!entry) return;

        $('#confirm-message').textContent = `Bạn có chắc muốn xóa kiến thức "${entry.title}"?`;
        deleteAction = async () => {
            setLoading(true);
            const { error } = await supabase
                .from('entries')
                .delete()
                .eq('id', entryId);

            if (error) {
                console.error('Lỗi xóa:', error);
                showToast('Lỗi xóa kiến thức!', 'error');
                setLoading(false);
                return;
            }

            showToast('Đã xóa kiến thức!');
            const entriesData = await fetchEntries(currentTopicId);
            renderEntriesList(entriesData);
            await fetchTopics();
            renderTopics(searchInput.value);
            setLoading(false);
        };
        openModal(modalConfirm);
    }

    // ============================================================
    //  EVENT LISTENERS
    // ============================================================

    $('#btn-add-topic').addEventListener('click', openAddTopicModal);
    $('#btn-add-first').addEventListener('click', openAddTopicModal);
    $('#btn-save-topic').addEventListener('click', saveTopic);

    $('#btn-back').addEventListener('click', () => {
        document.title = '📚 Kho Tàng Kiến Thức';
        showPage('page-home');
        renderTopics(searchInput.value);
    });

    $('#btn-edit-topic').addEventListener('click', openEditTopicModal);
    $('#btn-delete-topic').addEventListener('click', confirmDeleteTopic);

    $('#btn-add-entry').addEventListener('click', openAddEntryModal);
    $('#btn-add-first-entry').addEventListener('click', openAddEntryModal);
    $('#btn-save-entry').addEventListener('click', saveEntry);

    $('#btn-confirm-delete').addEventListener('click', async () => {
        if (deleteAction) {
            await deleteAction();
            deleteAction = null;
        }
        closeModal(modalConfirm);
    });

    // Search
    let searchDebounce = null;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            renderTopics(searchInput.value.trim());
        }, 200);
    });

    // Keyboard shortcuts
    modalTopic.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveTopic();
        }
    });

    modalEntry.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            saveEntry();
        }
    });

    // ============================================================
    //  INIT — Load data from Supabase
    // ============================================================

    async function init() {
        setLoading(true);
        await fetchTopics();
        renderTopics();
        setLoading(false);
    }

    init();
})();
