        let connection = null;
        let currentUserLogin = '';
        let rooms = [];
        let currentRoomId = null;
        let currentUserId = null;
        let currentName = '';
        let currentAvatar = null;
        let currentStatus = '';
        let chatSource = 'chats';
        let currentRoomIsGroup = false;
        let replyTo = null; // { id, name, text }
        let unreadCounts = {};
        let editingMessage = null; // { id, text }
        let chatImageFile = null;
        let chatImageUrl = null;
        let mediaRecorder = null;
        let audioChunks = [];
        let recordingTimer = null;
        let recordingSeconds = 0;
        let currentAudioUrl = null;
        let currentVideoUrl = null;
        let videoRecorder = null;
        let videoChunks = [];
        let recordingKind = null; // 'audio' | 'video'
        let currentStreak = 0;
        let currentBestStreak = 0;
        let currentFeedTab = 'foryou';
        let storyTextPos = { x: 50, y: 50 };

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js');
        }
// ===== ТЁМНАЯ ТЕМА =====
function toggleTheme() {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeUI();
}

function loadTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
        document.body.classList.add('dark');
    }
    updateThemeUI();
}

function updateThemeUI() {
    const isDark = document.body.classList.contains('dark');
    const sw = document.getElementById('themeSwitch');
    if (sw) sw.checked = isDark;
}

// Загружаем тему при старте
loadTheme();
 function showView(name) {
    document.getElementById('registerView').classList.add('hidden');
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('chatView').classList.add('hidden');
    document.getElementById('sectionView').classList.add('hidden');
    document.getElementById('chatsListView').classList.add('hidden');
    document.getElementById('feedView').classList.add('hidden');
    document.getElementById('userProfileView').classList.add('hidden');
    document.getElementById('groupsView').classList.add('hidden');
    document.getElementById('groupView').classList.add('hidden');
    document.getElementById('friendsView').classList.add('hidden');

    if (name === 'register') document.getElementById('registerView').classList.remove('hidden');
    else if (name === 'login') document.getElementById('loginView').classList.remove('hidden');
    else if (name === 'chat') document.getElementById('chatView').classList.remove('hidden');
    else if (name === 'section') document.getElementById('sectionView').classList.remove('hidden');
    else if (name === 'chatsList') document.getElementById('chatsListView').classList.remove('hidden');
    else if (name === 'feed') document.getElementById('feedView').classList.remove('hidden');
    else if (name === 'userProfile') document.getElementById('userProfileView').classList.remove('hidden');
    else if (name === 'groups') document.getElementById('groupsView').classList.remove('hidden');
    else if (name === 'group') document.getElementById('groupView').classList.remove('hidden');
    else if (name === 'friends') document.getElementById('friendsView').classList.remove('hidden');

    localStorage.setItem('lastView', name);
    document.body.dataset.view = name;

    // Нижняя навигация
    const bnEl = document.getElementById('bottomNav');
    if (bnEl) {
        if (name === 'chat' || name === 'register' || name === 'login') bnEl.classList.add('hidden');
        else bnEl.classList.remove('hidden');
    }
    document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
    const navMap = { feed: 'navFeed', chatsList: 'navChats', chat: 'navChats', groups: 'navGroups', group: 'navGroups', friends: 'navFriends', section: 'navProfile', userProfile: 'navProfile' };
    const navId = navMap[name];
    if (navId) { const el = document.getElementById(navId); if (el) el.classList.add('active'); }
}
         
        
        async function api(url, method = 'GET', body = null) {
            const options = { method, headers: {}, credentials: 'same-origin' };

            if (body) {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(body);
            }

            const response = await fetch(url, options);

            if (!response.ok) {
                let message = 'Ошибка запроса';

                try {
                    const text = await response.text();
                    if (text) {
                        const data = JSON.parse(text);
                        if (data.error) message = data.error;
                    }
                } catch { }

                throw new Error(message);
            }

            const text = await response.text();
            return text ? JSON.parse(text) : null;
        }
        
function openSection(name) {
    document.getElementById('sideMenu').classList.remove('open');

    if (name === 'chats') {
        showView('chatsList');
        loadRooms().then(() => fillPreviews());
        return;
    }

    if (name === 'feed') {
        showView('feed');
        loadFeed();
        return;
    }

        if (name === 'profile') {
        showView('section');
        document.getElementById('sectionTitle').textContent = 'Мой профиль';
        document.getElementById('profileScreen').classList.remove('hidden');
        document.getElementById('settingsScreen').classList.add('hidden');
        document.getElementById('genericSection').classList.add('hidden');
        fillProfile();
        return;
    }

    if (name === 'settings') {
        showView('section');
        document.getElementById('sectionTitle').textContent = '⚙️ Настройки';
        document.getElementById('settingsScreen').classList.remove('hidden');
        document.getElementById('profileScreen').classList.add('hidden');
        document.getElementById('genericSection').classList.add('hidden');
        return;
    }

    if (name === 'groups') {
        showView('groups');
        loadGroups();
        return;
    }

        if (name === 'friends') {
        showView('friends');
        loadFriends();
        loadFriendRequests();
        return;
    }
    const titles = {
        groups: '👥 Группы',
        findFriend: '🔍 Поиск друзей',
        findGroup: '🌐 Поиск группы',
        settings: '⚙️ Настройки'
    };

    showView('section');
    document.getElementById('sectionTitle').textContent = titles[name] || name;
    document.getElementById('profileScreen').classList.add('hidden');
    document.getElementById('genericSection').classList.remove('hidden');
    document.getElementById('genericSection').textContent = titles[name] || name;
}

async function fillProfile() {
    const avatarEl = document.getElementById('profileAvatar');
    avatarEl.innerHTML = '';
    if (currentAvatar) {
        const img = document.createElement('img');
        img.src = currentAvatar;
        avatarEl.appendChild(img);
    } else {
        avatarEl.textContent = (currentName || '?').charAt(0).toUpperCase();
    }

    document.getElementById('profileName').textContent = currentName || '';
    document.getElementById('profileLogin').textContent = '@' + (currentUserLogin || '');

    const statusEl = document.getElementById('profileStatus');
    const pencilBtn = document.getElementById('statusEditBtn');
    const addBtn = document.getElementById('addStatusBtn');

    if (currentStatus) {
        statusEl.textContent = currentStatus;
        statusEl.classList.remove('hidden');
        pencilBtn.classList.remove('hidden');
        addBtn.classList.add('hidden');
    } else {
        statusEl.classList.add('hidden');
        pencilBtn.classList.add('hidden');
        addBtn.classList.remove('hidden');
    }

    // Стрик
    const streakBar = document.getElementById('streakBar');
    if (currentStreak > 0) {
        document.getElementById('streakCount').textContent = currentStreak;
        document.getElementById('streakBest').textContent = '🏆 ' + currentBestStreak;
        streakBar.classList.remove('hidden');
    } else {
        streakBar.classList.add('hidden');
    }
    // Загружаем посты пользователя
    await loadUserPosts();
}

async function loadUserPosts() {
    try {
        const posts = await api('/api/posts');
        const myPosts = posts.filter(p => p.authorId === currentUserId);
        
        // Обновляем счётчики
        document.getElementById('profilePostsCount').textContent = myPosts.length;
        
        const totalReactions = myPosts.reduce((sum, p) => sum + p.count1 + p.count2, 0);
        document.getElementById('profileReactionsCount').textContent = totalReactions;
        
        document.getElementById('profileFriendsCount').textContent = friendsList.length;

        // Рендерим сетку
        const grid = document.getElementById('profilePostsGrid');
        grid.innerHTML = '';

        if (myPosts.length === 0) {
            grid.innerHTML = '<div class="profile-posts-empty">Пока нет постов<br><button class="add-post-circle" onclick="openCreatePostModal()" title="Добавить пост">+</button></div>';
            return;
        }

        myPosts.forEach(post => {
            const thumb = document.createElement('div');
            thumb.className = 'profile-post-thumb';
            thumb.onclick = () => openPostDetail(post.id);

            if (post.imageUrl) {
                const img = document.createElement('img');
                img.src = post.imageUrl;
                thumb.appendChild(img);
            } else {
                const textDiv = document.createElement('div');
                textDiv.className = 'profile-post-thumb-text';
                textDiv.textContent = post.text.substring(0, 50) + (post.text.length > 50 ? '...' : '');
                thumb.appendChild(textDiv);
            }

            // Overlay с реакциями
            const overlay = document.createElement('div');
            overlay.className = 'profile-post-thumb-overlay';
            overlay.innerHTML = `
                <span>${post.emoji1} ${post.count1}</span>
                <span>${post.emoji2} ${post.count2}</span>
                <span>💬 ${post.comments}</span>
            `;
            thumb.appendChild(overlay);

            grid.appendChild(thumb);
        });
    const addTile = document.createElement('div');
        addTile.className = 'add-post-tile';
        addTile.title = 'Добавить пост';
        addTile.innerHTML = '+';
        addTile.onclick = () => openCreatePostModal();
        grid.appendChild(addTile);
    } catch (e) {
        console.error('Error loading posts:', e);
    }
}

let currentDetailPostId = null;

async function openPostDetail(postId) {
    currentDetailPostId = postId;
    localStorage.setItem('lastPostId', postId);
    document.getElementById('postDetailModal').classList.remove('hidden');
    document.getElementById('postDetailContent').innerHTML = '<div class="feed-loading">Загрузка...</div>';

    try {
        const posts = await api('/api/posts');
        const post = posts.find(p => p.id === postId);

        if (!post) {
            document.getElementById('postDetailContent').innerHTML = '<div class="feed-empty">Пост не найден</div>';
            return;
        }

        const comments = await api(`/api/posts/${postId}/comments`);
        renderPostDetail(post, comments);
    } catch (e) {
        document.getElementById('postDetailContent').innerHTML = '<div class="feed-empty">Не удалось загрузить пост</div>';
    }
}

function closePostDetail() {
    document.getElementById('postDetailModal').classList.add('hidden');
}

function renderPostDetail(post, comments) {
    const content = document.getElementById('postDetailContent');
    content.innerHTML = '';

    // Автор
        // Автор
    const header = document.createElement('div');
    header.className = 'post-header';

    const avatar = document.createElement('div');
    avatar.className = 'post-avatar';
    avatar.onclick = () => openUserCard(post.authorId, 'feed');
    avatar.style.cursor = 'pointer';
    if (post.authorAvatar) {
        const img = document.createElement('img');
        img.src = post.authorAvatar;
        avatar.appendChild(img);
    } else {
        avatar.textContent = (post.authorName || '?').charAt(0).toUpperCase();
    }

    const name = document.createElement('div');
    name.className = 'post-author-name';
    name.textContent = post.authorName;

    header.appendChild(avatar);
    header.appendChild(name);
    content.appendChild(header);

    // Текст
    if (post.text) {
        const text = document.createElement('div');
        text.className = 'post-text';
        text.textContent = post.text;
        content.appendChild(text);
    }

    // Фото (в полный размер)
    if (post.imageUrl) {
        const img = document.createElement('img');
        img.className = 'post-detail-image';
        img.src = post.imageUrl;
        content.appendChild(img);
    }

    // Реакции
    const actions = document.createElement('div');
    actions.className = 'post-actions';

    const btn1 = document.createElement('button');
    btn1.className = 'react-btn' + (post.myReaction === post.emoji1 ? ' active' : '');
    btn1.innerHTML = `${post.emoji1} <span>${post.count1}</span>`;
    btn1.onclick = () => reactInDetail(post.id, post.emoji1);

    const btn2 = document.createElement('button');
    btn2.className = 'react-btn' + (post.myReaction === post.emoji2 ? ' active' : '');
    btn2.innerHTML = `${post.emoji2} <span>${post.count2}</span>`;
    btn2.onclick = () => reactInDetail(post.id, post.emoji2);

    actions.appendChild(btn1);
    actions.appendChild(btn2);
    content.appendChild(actions);

    // Комментарии
    const title = document.createElement('div');
    title.className = 'comments-title';
    title.textContent = `Комментарии (${comments.length})`;
    content.appendChild(title);

    if (comments.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'comments-empty';
        empty.textContent = 'Пока нет комментариев. Будь первым!';
        content.appendChild(empty);
    }

    comments.forEach(c => {
        const row = document.createElement('div');
        row.className = 'comment-row';

        const cav = document.createElement('div');
        cav.className = 'comment-avatar';
        if (c.avatarUrl) {
            const img = document.createElement('img');
            img.src = c.avatarUrl;
            cav.appendChild(img);
        } else {
            cav.textContent = (c.name || '?').charAt(0).toUpperCase();
        }

        const body = document.createElement('div');
        body.className = 'comment-body';

        const cname = document.createElement('div');
        cname.className = 'comment-name';
        cname.textContent = c.name;

        const ctext = document.createElement('div');
        ctext.className = 'comment-text';
        ctext.textContent = c.text;

        body.appendChild(cname);
        body.appendChild(ctext);
        row.appendChild(cav);
        row.appendChild(body);
        content.appendChild(row);
    });
}

async function reactInDetail(postId, emoji) {
    try {
        await api(`/api/posts/${postId}/react`, 'POST', { emoji: emoji });
        await openPostDetail(postId);
    } catch (e) {
        alert('Не удалось поставить реакцию');
    }
}

async function sendComment() {
    const input = document.getElementById('commentInput');
    const text = input.value.trim();
    if (!text || !currentDetailPostId) return;

    try {
        await api(`/api/posts/${currentDetailPostId}/comments`, 'POST', { text: text });
        input.value = '';
        await openPostDetail(currentDetailPostId);
    } catch (e) {
        alert(e.message || 'Не удалось отправить комментарий');
    }
}

// ===== ЛЕНТА ПОСТОВ =====
let feedPosts = {};
let postImageFile = null;
let postImageUrl = null;
let selectedEmojis = ['❤️', '🔥'];
let emojiSlot = 1;

async function loadFeed() {
    const list = document.getElementById('feedList');
        loadStories();
    list.innerHTML = '<div class="feed-empty">Постов пока нет. Будь первым.</div>';
    
    try {
        const posts = await api('/api/posts');
        feedPosts = {};
        posts.forEach(p => { feedPosts[p.id] = p; });
        list.innerHTML = '';
        
        if (posts.length === 0) {
            list.innerHTML = '<div class="feed-empty">Постов пока нет. Будь первым! ✨</div>';
            return;
        }
        
        posts.forEach(post => {
            const card = createPostCard(post);
            list.appendChild(card);
        });
    } catch (e) {
        list.innerHTML = '<div class="feed-empty">Не удалось загрузить ленту</div>';
    }
}

function switchFeedTab(tab) {
    currentFeedTab = tab;
    document.getElementById('tabForYou').classList.toggle('active', tab === 'foryou');
    document.getElementById('tabFollowing').classList.toggle('active', tab === 'following');
    loadFeed();
}

function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.dataset.postId = post.id;
    
    const header = document.createElement('div');
    header.className = 'post-header';
    
    const avatar = document.createElement('div');
    avatar.className = 'post-avatar';
    avatar.onclick = () => openUserCard(post.authorId, 'feed');
    avatar.style.cursor = 'pointer';
    if (post.authorAvatar) {
        const img = document.createElement('img');
        img.src = post.authorAvatar;
        avatar.appendChild(img);
    } else {
        avatar.textContent = (post.authorName || '?').charAt(0).toUpperCase();
    }
    
    const name = document.createElement('div');
    name.className = 'post-author-name';
    name.textContent = post.authorName;
    
    header.appendChild(avatar);
    header.appendChild(name);
    card.appendChild(header);
    
    if (post.text) {
        const text = document.createElement('div');
        text.className = 'post-text';
        text.textContent = post.text;
        card.appendChild(text);
    }
    
    if (post.imageUrl) {
        const img = document.createElement('img');
        img.className = 'post-image';
        img.src = post.imageUrl;
        card.appendChild(img);
    }
    
    const actions = document.createElement('div');
    actions.className = 'post-actions';
    
    const btn1 = document.createElement('button');
    btn1.className = 'react-btn' + (post.myReaction === post.emoji1 ? ' active' : '');
    btn1.innerHTML = `${post.emoji1} <span>${post.count1}</span>`;
    btn1.onclick = () => reactToPost(post.id, post.emoji1);
    
    const btn2 = document.createElement('button');
    btn2.className = 'react-btn' + (post.myReaction === post.emoji2 ? ' active' : '');
    btn2.innerHTML = `${post.emoji2} <span>${post.count2}</span>`;
    btn2.onclick = () => reactToPost(post.id, post.emoji2);
    
    const commentBtn = document.createElement('button');
    commentBtn.className = 'react-btn';
    commentBtn.innerHTML = `💬 <span>${post.comments}</span>`;
    commentBtn.onclick = () => openPostDetail(post.id);
    
    actions.appendChild(btn1);
    actions.appendChild(btn2);
    actions.appendChild(commentBtn);
    card.appendChild(actions);
    
    return card;
}

async function reactToPost(postId, emoji) {
    const post = feedPosts[postId];
    if (!post) return;

    try {
        await api(`/api/posts/${postId}/react`, 'POST', { emoji: emoji });

        // Обновляем данные локально — БЕЗ перезагрузки ленты
        if (post.myReaction === emoji) {
            if (emoji === post.emoji1) post.count1--;
            else post.count2--;
            post.myReaction = '';
        } else {
            if (post.myReaction === post.emoji1) post.count1--;
            if (post.myReaction === post.emoji2) post.count2--;
            if (emoji === post.emoji1) post.count1++;
            else post.count2++;
            post.myReaction = emoji;
        }

        updatePostCardActions(post);
    } catch (e) {
        alert('Не удалось поставить реакцию');
    }
}

function updatePostCardActions(post) {
    const card = document.querySelector(`.post-card[data-post-id="${post.id}"]`);
    if (!card) return;
    const actions = card.querySelector('.post-actions');
    if (!actions) return;
    actions.innerHTML = '';

    const btn1 = document.createElement('button');
    btn1.className = 'react-btn' + (post.myReaction === post.emoji1 ? ' active' : '');
    btn1.innerHTML = `${post.emoji1} <span>${post.count1}</span>`;
    btn1.onclick = () => reactToPost(post.id, post.emoji1);

    const btn2 = document.createElement('button');
    btn2.className = 'react-btn' + (post.myReaction === post.emoji2 ? ' active' : '');
    btn2.innerHTML = `${post.emoji2} <span>${post.count2}</span>`;
    btn2.onclick = () => reactToPost(post.id, post.emoji2);

    const commentBtn = document.createElement('button');
    commentBtn.className = 'react-btn';
    commentBtn.innerHTML = `💬 <span>${post.comments}</span>`;
    commentBtn.onclick = () => openPostDetail(post.id);

    actions.appendChild(btn1);
    actions.appendChild(btn2);
    actions.appendChild(commentBtn);
}

// ===== СОЗДАНИЕ ПОСТА =====
function openCreatePostModal() {
    document.getElementById('postText').value = '';
    document.getElementById('charCount').textContent = '0';
    removePostImage();
    selectedEmojis = ['❤️', '🔥'];
    emojiSlot = 1;
    updateSelectedEmojis();
    document.getElementById('createPostModal').classList.remove('hidden');
}

function closeCreatePostModal() {
    document.getElementById('createPostModal').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('postText');
    if (textarea) {
        textarea.addEventListener('input', () => {
            document.getElementById('charCount').textContent = textarea.value.length;
        });
    }
});

function previewPostImage() {
    const input = document.getElementById('postImageInput');
    const file = input.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        alert('Файл слишком большой (макс 5 МБ)');
        input.value = '';
        return;
    }

    postImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('previewImg').src = e.target.result;
        document.getElementById('imagePreview').classList.remove('hidden');
        document.getElementById('addPhotoBtn').classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

function removePostImage() {
    postImageFile = null;
    postImageUrl = null;
    document.getElementById('imagePreview').classList.add('hidden');
    document.getElementById('addPhotoBtn').classList.remove('hidden');
    document.getElementById('postImageInput').value = '';
}

function selectEmoji(emoji) {
    if (emojiSlot === 1) {
        selectedEmojis[0] = emoji;
        emojiSlot = 2;
    } else {
        selectedEmojis[1] = emoji;
        emojiSlot = 1;
    }
    updateSelectedEmojis();
}

function updateSelectedEmojis() {
    document.getElementById('selectedEmoji1').textContent = selectedEmojis[0];
    document.getElementById('selectedEmoji2').textContent = selectedEmojis[1];
}

async function createPost() {
    const text = document.getElementById('postText').value.trim();

    if (!text && !postImageFile) {
        alert('Напиши что-нибудь или добавь фото');
        return;
    }

    const btn = document.getElementById('publishBtn');
    btn.disabled = true;
    btn.textContent = 'Публикую...';

    try {
        let imageUrl = null;
        if (postImageFile) {
            const fd = new FormData();
            fd.append('image', postImageFile);
            const res = await fetch('/api/postimage', {
                method: 'POST',
                body: fd,
                credentials: 'same-origin'
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Не удалось загрузить фото');
            }
            const data = await res.json();
            imageUrl = data.imageUrl;
        }

        await api('/api/posts', 'POST', {
            text: text,
            emoji1: selectedEmojis[0],
            emoji2: selectedEmojis[1],
            imageUrl: imageUrl
        });

        closeCreatePostModal();
        await loadFeed();

    } catch (e) {
        alert(e.message || 'Не удалось опубликовать пост');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Опубликовать';
    }
}

async function updateStatus() {
    const input = document.getElementById('statusInput');
    if (!input) return;

    const status = input.value.trim();

    try {
        const res = await fetch('/api/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: status }),
            credentials: 'same-origin'
        });

        const data = await res.json();

        if (res.ok) {
            currentStatus = data.status;
            fillProfile();
            closeStatusModal();
        } else {
            alert(data.error || 'Не удалось сохранить статус');
        }
    } catch {
        alert('Ошибка при сохранении статуса');
    }
}

function openStatusModal() {
    const modal = document.getElementById('statusModal');
    const input = document.getElementById('statusInput');
    if (modal && input) {
        input.value = currentStatus || '';
        modal.classList.remove('hidden');
    }
}

function closeStatusModal() {
    const modal = document.getElementById('statusModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// ===== МЕНЮШКА АВАТАРА =====
function openAvatarMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('avatarMenu');

    if (!menu.classList.contains('hidden')) {
        closeAvatarMenu();
        return;
    }

    const rect = document.getElementById('profileAvatar').getBoundingClientRect();
    menu.classList.remove('hidden');

    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;

    // Справа от авы, по центру
    let left = rect.right + 12;
    let top = rect.top + rect.height / 2 - mh / 2;

    // Если справа не влезает (телефон) — показываем под авой
    if (left + mw > window.innerWidth - 10) {
        left = rect.left + rect.width / 2 - mw / 2;
        top = rect.bottom + 10;
    }

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
}

function closeAvatarMenu() {
    document.getElementById('avatarMenu').classList.add('hidden');
}

// Клик мимо менюшки — она закрывается
document.addEventListener('click', (e) => {
    const menu = document.getElementById('avatarMenu');
    if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target)) {
        closeAvatarMenu();
    }
    const cmenu = document.getElementById('chatMenu');
    if (cmenu && !cmenu.classList.contains('hidden') && !cmenu.contains(e.target)) {
        closeChatMenu();
    }
});

function viewAvatar() {
    closeAvatarMenu();
    if (!currentAvatar) {
        alert('У тебя пока нет авы 🙈 Нажми «Заменить аву», чтобы поставить!');
        return;
    }
    document.getElementById('avatarViewImg').src = currentAvatar;
    document.getElementById('avatarViewModal').classList.remove('hidden');
}

function closeAvatarView() {
    document.getElementById('avatarViewModal').classList.add('hidden');
}

// ===== КАРТОЧКА ПОЛЬЗОВАТЕЛЯ =====
async function openUserCard(userId, context) {
    if (userId === currentUserId) {
        openSection('profile');
        return;
    }
    try {
        const data = await api(`/api/user/${userId}/profile`);
        renderUserCard(data, context);
        document.getElementById('userCardModal').classList.remove('hidden');
    } catch (e) {
        alert('Не удалось открыть профиль');
    }
}

function closeUserCard() {
    document.getElementById('userCardModal').classList.add('hidden');
}

async function renderUserCard(u, context) {
    const av = document.getElementById('userCardAvatar');
    av.innerHTML = '';
    if (u.avatarUrl) {
        const img = document.createElement('img');
        img.src = u.avatarUrl;
        av.appendChild(img);
    } else {
        av.textContent = (u.name || '?').charAt(0).toUpperCase();
    }

    document.getElementById('userCardName').textContent = u.name;
    document.getElementById('userCardLogin').textContent = '@' + u.login;

    const statusEl = document.getElementById('userCardStatus');
    if (u.status) {
        statusEl.textContent = u.status;
        statusEl.classList.remove('hidden');
    } else {
        statusEl.classList.add('hidden');
    }

    // Первые 3 публикации
    const grid = document.getElementById('userCardPosts');
    grid.innerHTML = '';
    if (!u.posts || u.posts.length === 0) {
        grid.innerHTML = '<div class="user-card-empty">Нет публикаций 😔</div>';
    } else {
        u.posts.slice(0, 3).forEach(post => {
            const thumb = document.createElement('div');
            thumb.className = 'user-card-thumb';
            if (post.imageUrl) {
                const img = document.createElement('img');
                img.src = post.imageUrl;
                thumb.appendChild(img);
            } else {
                thumb.textContent = post.text.substring(0, 30);
            }
            grid.appendChild(thumb);
        });
    }

    // Кнопки
    const btns = document.getElementById('userCardButtons');
    btns.innerHTML = '';

    // Статус дружбы
    const status = await getFriendStatus(u.id);

    if (status === 'none') {
        const addBtn = document.createElement('button');
        addBtn.className = 'add-friend-btn primary';
        addBtn.textContent = 'Добавить в друзья';
        addBtn.onclick = async () => {
            try {
                await api('/api/friends/request', 'POST', { login: u.login });
                addBtn.textContent = 'Заявка отправлена ✓';
                addBtn.classList.remove('primary');
                addBtn.classList.add('secondary');
                addBtn.disabled = true;
                await loadFriendRequests();
            } catch (e) {
                alert(e.message);
            }
        };
        btns.appendChild(addBtn);
    } else if (status === 'incoming') {
        const addBtn = document.createElement('button');
        addBtn.className = 'add-friend-btn secondary';
        addBtn.textContent = 'Ответь в разделе Друзья';
        addBtn.disabled = true;
        btns.appendChild(addBtn);
    } else if (status === 'friend') {
        const addBtn = document.createElement('button');
        addBtn.className = 'add-friend-btn secondary';
        addBtn.textContent = '✓ Вы друзья';
        addBtn.disabled = true;
        btns.appendChild(addBtn);
    }

    // Кнопки действий
    if (context === 'private') {
        const b = document.createElement('button');
        b.className = 'user-card-btn primary';
        b.textContent = 'Перейти в профиль';
        b.onclick = () => { closeUserCard(); openUserProfile(u.id); };
        btns.appendChild(b);
    } else {
        const b = document.createElement('button');
        b.className = 'user-card-btn primary';
        b.textContent = 'Написать сообщение';
        b.onclick = () => startDirectWith(u.id);
        btns.appendChild(b);

        const b2 = document.createElement('button');
        b2.className = 'user-card-btn secondary';
        b2.textContent = 'Перейти в профиль';
        b2.onclick = () => { closeUserCard(); openUserProfile(u.id); };
        btns.appendChild(b2);
    }
}

async function startDirectWith(userId) {
    closeUserCard();
    try {
        const room = await api(`/api/direct/${userId}`, 'POST');
        if (room && room.id) {
            await loadRooms();
            await selectRoom(room.id);
            chatSource = 'chats';
            showView('chat');
        }
    } catch (e) {
        alert('Не удалось начать чат: ' + e.message);
    }
}

// ===== ЧУЖОЙ ПРОФИЛЬ =====
async function openUserProfile(userId) {
    try {
        const data = await api(`/api/user/${userId}/profile`);
        showView('userProfile');
        renderUserProfile(data);
    } catch (e) {
        alert('Не удалось открыть профиль');
    }
}

async function renderUserProfile(u) {
    const av = document.getElementById('userProfileAvatar');
    av.innerHTML = '';
    if (u.avatarUrl) {
        const img = document.createElement('img');
        img.src = u.avatarUrl;
        av.appendChild(img);
        av.onclick = () => {
            document.getElementById('avatarViewImg').src = u.avatarUrl;
            document.getElementById('avatarViewModal').classList.remove('hidden');
        };
    } else {
        av.textContent = (u.name || '?').charAt(0).toUpperCase();
        av.onclick = null;
    }

    document.getElementById('userProfileName').textContent = u.name;
    document.getElementById('userProfileLogin').textContent = '@' + u.login;

    // Счётчики
    document.getElementById('userProfilePostsCount').textContent = u.postsCount || 0;
    document.getElementById('userProfileFriendsCount').textContent = u.friendsCount || 0;

    const statusEl = document.getElementById('userProfileStatus');
    if (u.status) {
        statusEl.textContent = u.status;
        statusEl.classList.remove('hidden');
    } else {
        statusEl.classList.add('hidden');
    }

    // Сетка постов
    const grid = document.getElementById('userProfileGrid');
    grid.innerHTML = '';
    if (!u.posts || u.posts.length === 0) {
        grid.innerHTML = '<div class="profile-posts-empty">Нет публикаций 😔</div>';
    } else {
        u.posts.forEach(post => {
            const thumb = document.createElement('div');
            thumb.className = 'profile-post-thumb';
            thumb.onclick = () => openPostDetail(post.id);
            if (post.imageUrl) {
                const img = document.createElement('img');
                img.src = post.imageUrl;
                thumb.appendChild(img);
            } else {
                const t = document.createElement('div');
                t.className = 'profile-post-thumb-text';
                t.textContent = post.text.substring(0, 50);
                thumb.appendChild(t);
            }
            const overlay = document.createElement('div');
            overlay.className = 'profile-post-thumb-overlay';
            overlay.innerHTML = `<span>${post.emoji1} ${post.count1}</span><span>${post.emoji2} ${post.count2}</span><span>💬 ${post.comments}</span>`;
            thumb.appendChild(overlay);
            grid.appendChild(thumb);
        });
    }

    // Кнопки: друзья + написать (контейнер очищается — ДУБЛЕЙ НЕ БУДЕТ)
    const actions = document.getElementById('userProfileActions');
    actions.innerHTML = '';

    const status = await getFriendStatus(u.id);

    if (status === 'none') {
        const addBtn = document.createElement('button');
        addBtn.className = 'action-btn blue';
        addBtn.textContent = 'Добавить в друзья';
        addBtn.onclick = async () => {
            try {
                await api('/api/friends/request', 'POST', { login: u.login });
                addBtn.textContent = 'Заявка отправлена ✓';
                addBtn.disabled = true;
                await loadFriendRequests();
            } catch (e) {
                alert(e.message);
            }
        };
        actions.appendChild(addBtn);
    } else if (status === 'incoming') {
        const addBtn = document.createElement('button');
        addBtn.className = 'action-btn';
        addBtn.textContent = 'Ответь в разделе Друзья';
        addBtn.disabled = true;
        actions.appendChild(addBtn);
    } else if (status === 'friend') {
        const addBtn = document.createElement('button');
        addBtn.className = 'action-btn';
        addBtn.textContent = '✓ В друзьях';
        addBtn.onclick = () => {
            showConfirm('Удалить из друзей?', `${u.name} больше не будет твоим другом.`, async () => {
                try {
                    await api(`/api/friends/remove/${u.id}`, 'POST');
                    await loadFriends();
                    await loadFriendRequests();
                    await openUserProfile(u.id);
                } catch (e) {
                    alert(e.message);
                }
            });
        };
        actions.appendChild(addBtn);
    }

    if (u.id !== currentUserId) {
        const msgBtn = document.createElement('button');
        msgBtn.className = 'action-btn blue';
        msgBtn.textContent = '✉️ Написать';
        msgBtn.onclick = () => startDirectWith(u.id);
        actions.appendChild(msgBtn);
    }
}


function backFromUserProfile() {
    showView('chatsList');
    loadRooms().then(() => fillPreviews());
}

// ===== ГРУППЫ =====
async function loadGroups() {
    const myWrap = document.getElementById('myGroupsList');
    const openWrap = document.getElementById('openGroupsList');
    myWrap.innerHTML = '';
    openWrap.innerHTML = '';

    try {
        const groups = await api('/api/groups');
        const mine = groups.filter(g => g.isMember);
        const open = groups.filter(g => !g.isMember && !g.isPrivate);

        document.getElementById('myGroupsTitle').classList.toggle('hidden', mine.length === 0);
        document.getElementById('openGroupsTitle').classList.toggle('hidden', open.length === 0);

        if (mine.length === 0 && open.length === 0) {
            myWrap.innerHTML = '<div class="feed-empty">Пока нет групп. Создай первую!</div>';
        }

        mine.forEach(g => myWrap.appendChild(createGroupRow(g, true)));
        open.forEach(g => openWrap.appendChild(createGroupRow(g, false)));
    } catch (e) {
        myWrap.innerHTML = '<div class="feed-empty">Не удалось загрузить группы</div>';
    }
}

function createGroupRow(g, isMine) {
    const row = document.createElement('div');
    row.className = 'chat-row';

    const avatar = document.createElement('div');
    avatar.className = 'chat-row-avatar group-avatar';
    avatar.textContent = g.name.charAt(0).toUpperCase();

    const info = document.createElement('div');
    info.className = 'chat-row-info';

    const name = document.createElement('div');
    name.className = 'chat-row-name';
    name.textContent = g.name;

    const sub = document.createElement('div');
    sub.className = 'chat-row-last';
    sub.textContent = g.membersCount + ' участн.' + (g.isPrivate ? ' · приватная' : '');

    info.appendChild(name);
    info.appendChild(sub);
    row.appendChild(avatar);
    row.appendChild(info);

    if (isMine) {
        const badge = document.createElement('div');
        badge.className = 'group-role-badge' + (g.myRole === 'admin' ? ' admin' : g.myRole === 'moder' ? ' moder' : '');
        badge.textContent = g.myRole === 'admin' ? 'админ' : g.myRole === 'moder' ? 'модератор' : 'участник';
        row.appendChild(badge);
        row.onclick = () => openGroupChatById(g.id);
    } else {
        const btn = document.createElement('button');
        btn.className = 'join-btn';
        btn.textContent = 'Вступить';
        btn.onclick = (e) => { e.stopPropagation(); joinGroup(g.id); };
        row.appendChild(btn);
    }

    return row;
}

// ===== ДРУЗЬЯ =====
let friendsList = [];
let friendRequests = [];
let currentFriendsTab = 'friends';

async function loadFriends() {
    try {
        friendsList = await api('/api/friends');
        if (currentFriendsTab === 'friends') renderFriends();
    } catch (e) {
        console.error('Ошибка загрузки друзей:', e);
    }
}

async function loadFriendRequests() {
    try {
        friendRequests = await api('/api/friends/requests');
        updateRequestsBadge();
        if (currentFriendsTab === 'requests') renderFriends();
    } catch (e) {
        console.error('Ошибка загрузки заявок:', e);
    }
}

function updateRequestsBadge() {
    const badge = document.getElementById('requestsBadge');
    if (!badge) return;
    if (friendRequests.length > 0) {
        badge.textContent = friendRequests.length;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function switchFriendsTab(tab) {
    currentFriendsTab = tab;
    document.getElementById('tabFriends').classList.toggle('active', tab === 'friends');
    document.getElementById('tabRequests').classList.toggle('active', tab === 'requests');
    renderFriends();
}

function renderFriends() {
    const list = document.getElementById('friendsList');
    list.innerHTML = '';

    if (currentFriendsTab === 'friends') {
        if (friendsList.length === 0) {
            list.innerHTML = `
                <div class="friends-empty">
                    <div class="friends-empty-icon">👥</div>
                    <div class="friends-empty-text">Пока нет друзей</div>
                    <div class="friends-empty-sub">Добавь кого-нибудь через поиск сверху</div>
                </div>`;
            return;
        }
        friendsList.forEach(f => list.appendChild(createFriendCard(f, 'friend')));
    } else {
        if (friendRequests.length === 0) {
            list.innerHTML = `
                <div class="friends-empty">
                    <div class="friends-empty-icon">✉️</div>
                    <div class="friends-empty-text">Нет новых заявок</div>
                    <div class="friends-empty-sub">Когда кто-то захочет с тобой дружить — увидишь здесь</div>
                </div>`;
            return;
        }
        friendRequests.forEach(f => list.appendChild(createFriendCard(f, 'request')));
    }
}

function createFriendCard(f, type) {
    const card = document.createElement('div');
    card.className = 'friend-card';

    // Аватар
    const av = document.createElement('div');
    av.className = 'friend-avatar';
    if (f.avatarUrl) {
        const img = document.createElement('img');
        img.src = f.avatarUrl;
        av.appendChild(img);
    } else {
        av.textContent = (f.name || '?').charAt(0).toUpperCase();
    }
    av.onclick = () => openUserCard(f.id || f.userId, 'feed');

    av.dataset.uid = f.id;
    setOnlineDot(av, f.id);

    // Инфо
    const info = document.createElement('div');
    info.className = 'friend-info';
    info.onclick = () => openUserCard(f.id || f.userId, 'feed');

    const name = document.createElement('div');
    name.className = 'friend-name';
    name.textContent = f.name;

    const login = document.createElement('div');
    login.className = 'friend-login';
    login.textContent = '@' + f.login;

    info.appendChild(name);
    info.appendChild(login);

    if (f.status) {
        const st = document.createElement('div');
        st.className = 'friend-status';
        st.textContent = f.status;
        info.appendChild(st);
    }

    card.appendChild(av);
    card.appendChild(info);

    // Кнопки
    const actions = document.createElement('div');
    actions.className = 'friend-actions';

    if (type === 'request') {
        const acceptBtn = document.createElement('button');
        acceptBtn.className = 'friend-btn accept';
        acceptBtn.textContent = 'Принять';
        acceptBtn.onclick = () => acceptFriendRequest(f.id);

        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'friend-btn secondary';
        rejectBtn.textContent = 'Отклонить';
        rejectBtn.onclick = () => rejectFriendRequest(f.id);

        actions.appendChild(acceptBtn);
        actions.appendChild(rejectBtn);
    } else {
                const msgBtn = document.createElement('button');
        msgBtn.className = 'friend-btn primary';
        msgBtn.textContent = 'Написать';
        msgBtn.onclick = async () => {
            try {
                const room = await api(`/api/direct/${f.id}`, 'POST');
                if (room && room.id) {
                    await loadRooms();
                    await selectRoom(room.id);
                    chatSource = 'chats';
                    showView('chat');
                }
            } catch (e) {
                alert('Не удалось начать чат: ' + e.message);
            }
        };

        const removeBtn = document.createElement('button');
        removeBtn.className = 'friend-btn danger';
        removeBtn.textContent = 'Удалить';
        removeBtn.onclick = () => {
            showConfirm('Удалить из друзей?', `${f.name} больше не будет твоим другом.`, async () => {
                try {
                    await api(`/api/friends/remove/${f.id}`, 'POST');
                    await loadFriends();
                } catch (e) {
                    alert(e.message);
                }
            });
        };

        actions.appendChild(msgBtn);
        actions.appendChild(removeBtn);
    }

    card.appendChild(actions);
    return card;
}

async function sendFriendRequest() {
    const input = document.getElementById('friendSearchInput');
    const login = input.value.trim();
    if (!login) return;

    try {
        await api('/api/friends/request', 'POST', { login: login });
        input.value = '';
        alert('Заявка отправлена!');
        await loadFriendRequests();
    } catch (e) {
        alert(e.message);
    }
}

async function acceptFriendRequest(requestId) {
    try {
        await api(`/api/friends/accept/${requestId}`, 'POST');
        await loadFriendRequests();
        await loadFriends();
    } catch (e) {
        alert(e.message);
    }
}

async function rejectFriendRequest(requestId) {
    try {
        await api(`/api/friends/reject/${requestId}`, 'POST');
        await loadFriendRequests();
    } catch (e) {
        alert(e.message);
    }
}

// Получить статус дружбы с пользователем
async function getFriendStatus(userId) {
    // Проверяем в друзьях
    if (friendsList.some(f => (f.id || f.userId) === userId)) return 'friend';
    // Проверяем во входящих заявках
    if (friendRequests.some(f => (f.userId || f.id) === userId)) return 'incoming';
    return 'none';
}

async function joinGroup(id) {
    try {
        await api(`/api/groups/${id}/join`, 'POST');
        await loadGroups();
        await loadRooms();
    } catch (e) {
        alert(e.message);
    }
}

function openCreateGroupModal() {
    document.getElementById('groupName').value = '';
    document.getElementById('groupDesc').value = '';
    document.getElementById('groupPrivate').checked = false;
    document.getElementById('createGroupModal').classList.remove('hidden');
}

function closeCreateGroupModal() {
    document.getElementById('createGroupModal').classList.add('hidden');
}

async function createGroup() {
    const name = document.getElementById('groupName').value.trim();
    if (!name) { alert('Введите название группы'); return; }

    try {
        await api('/api/groups', 'POST', {
            name: name,
            description: document.getElementById('groupDesc').value.trim(),
            isPrivate: document.getElementById('groupPrivate').checked
        });
        closeCreateGroupModal();
        await loadGroups();
        await loadRooms();
    } catch (e) {
        alert(e.message);
    }
}

// ===== ЭКРАН ГРУППЫ =====
let currentGroup = null;

async function openGroupScreen(groupId) {
    try {
        const data = await api(`/api/groups/${groupId}`);
        currentGroup = data;
        showView('group');
        renderGroupScreen(data);
    } catch (e) {
        alert(e.message || 'Не удалось открыть группу');
    }
        localStorage.setItem('lastGroupId', groupId);
}

function renderGroupScreen(g) {
    document.getElementById('groupTitle').textContent = g.name + (g.isPrivate ? ' · приватная' : '');

    const desc = document.getElementById('groupDesc');
    desc.textContent = g.description || '';
    desc.classList.toggle('hidden', !g.description);

    const canManage = g.myRole === 'admin' || g.myRole === 'moder';
    document.getElementById('groupInviteBlock').classList.toggle('hidden', !canManage);

    const list = document.getElementById('groupMembersList');
    list.innerHTML = '';

    g.members.forEach(m => {
        const row = document.createElement('div');
        row.className = 'chat-row';

        const av = document.createElement('div');
        av.className = 'chat-row-avatar';
        if (m.avatarUrl) {
            const img = document.createElement('img');
            img.src = m.avatarUrl;
            av.appendChild(img);
        } else {
            av.textContent = (m.name || '?').charAt(0).toUpperCase();
        }

        const info = document.createElement('div');
        info.className = 'chat-row-info';
        const name = document.createElement('div');
        name.className = 'chat-row-name';
        name.textContent = m.name;
        const sub = document.createElement('div');
        sub.className = 'chat-row-last';
        sub.textContent = '@' + m.login;
        info.appendChild(name);
        info.appendChild(sub);

        const badge = document.createElement('div');
        badge.className = 'group-role-badge' + (m.role === 'admin' ? ' admin' : m.role === 'moder' ? ' moder' : '');
        badge.textContent = m.role === 'admin' ? 'админ' : m.role === 'moder' ? 'модератор' : 'участник';

        row.appendChild(av);
        row.appendChild(info);
        row.appendChild(badge);

                if (m.id !== currentUserId) {
            const canRole = g.myRole === 'admin' && m.role !== 'admin';
            const canKick = (g.myRole === 'admin' && m.role !== 'admin') || (g.myRole === 'moder' && m.role === 'user');
            if (canRole || canKick) {
                const dotsBtn = document.createElement('button');
                dotsBtn.className = 'msg-menu-btn';
                dotsBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>';
                dotsBtn.onclick = (e) => {
                    e.stopPropagation();
                    openMemberMenu(e, g, m);
                };
                row.appendChild(dotsBtn);
            }
        }

        list.appendChild(row);
    });
}

function openMemberMenu(e, g, m) {
    const menu = document.getElementById('chatMenu');
    if (!menu.classList.contains('hidden')) {
        closeChatMenu();
        return;
    }
    menu.innerHTML = '';

    // Роли — только админ и не против админа
    if (g.myRole === 'admin' && m.role !== 'admin') {
        if (m.role === 'moder') {
            addChatMenuItem(menu, 'Снять модератора', () => { closeChatMenu(); setMemberRole(m.id, 'user'); });
        } else {
            addChatMenuItem(menu, 'Назначить модератором', () => { closeChatMenu(); setMemberRole(m.id, 'moder'); });
        }
    }

    // Удаление из группы
    const canKick = (g.myRole === 'admin' && m.role !== 'admin') || (g.myRole === 'moder' && m.role === 'user');
    if (canKick) {
        addChatMenuItem(menu, 'Удалить из группы', () => {
            closeChatMenu();
            showConfirm('Удалить из группы?', `${m.name} будет убран из группы.`, async () => {
                try {
                    await api(`/api/groups/${g.id}/kick/${m.id}`, 'POST');
                    await openGroupScreen(g.id);
                } catch (err) {
                    alert(err.message);
                }
            });
        });
    }

    const rect = e.currentTarget.getBoundingClientRect();
    menu.classList.remove('hidden');

    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    let left = rect.right - mw;
    let top = rect.bottom + 8;
    if (left < 10) left = 10;
    if (top + mh > window.innerHeight - 10) top = rect.top - mh - 8;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
}

function backToGroups() {
    // Если пришли из чата группы — возвращаемся в чат
    if (currentGroup && currentRoomIsGroup) {
        openGroupChatById(currentGroup.id);
    } else {
        showView('groups');
        loadGroups();
    }
}

function openGroupChat() {
    if (!currentGroup) return;
    openGroupChatById(currentGroup.id);
}

async function openGroupChatById(id) {
    chatSource = 'groups';
    if (!currentGroup || currentGroup.id !== id) {
        try {
            currentGroup = await api(`/api/groups/${id}`);
        } catch (e) {
            alert('Не удалось открыть группу');
            return;
        }
    }
    currentRoomIsGroup = true;
    await selectRoom(id);

    // Шапка: название группы и ава с буквой
    document.getElementById('currentRoomTitle').textContent = currentGroup.name;
    const av = document.getElementById('headerAvatar');
    av.innerHTML = '';
    av.textContent = currentGroup.name.charAt(0).toUpperCase();
    av.onclick = () => openGroupScreen(currentGroup.id);
    av.style.cursor = 'pointer';

        showView('chat');
    updatePinnedBar();
    const pollBtn = document.getElementById('pollBtn');
    if (pollBtn) pollBtn.classList.remove('hidden');
    updateHeaderStatus();
    updateDisappearingIndicator(); 
}

// ===== МЕНЮ ЧАТА (ТРИ ТОЧКИ) =====
function openChatMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('chatMenu');

    if (!menu.classList.contains('hidden')) {
        closeChatMenu();
        return;
    }

    menu.innerHTML = '';

    if (currentRoomIsGroup) {
        addChatMenuItem(menu, 'Участники', () => { closeChatMenu(); openGroupScreen(currentGroup.id); });
    }
    addChatMenuItem(menu, 'Очистить чат', () => { closeChatMenu(); confirmClearChat(); });
    addChatMenuItem(menu, '⏳ Исчезающие', () => { closeChatMenu(); openDisappearingModal(); });

    if (currentRoomIsGroup) {
        addChatMenuItem(menu, 'Покинуть группу', () => { closeChatMenu(); confirmLeaveGroup(); });
    }

    const rect = e.currentTarget.getBoundingClientRect();
    menu.classList.remove('hidden');

    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    let left = rect.right - mw;
    let top = rect.bottom + 8;
    if (left < 10) left = 10;
    if (top + mh > window.innerHeight - 10) top = rect.top - mh - 8;

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
}

function addChatMenuItem(menu, text, onclick) {
    const b = document.createElement('button');
    b.className = 'avatar-menu-item';
    b.textContent = text;
    b.onclick = onclick;
    menu.appendChild(b);
}

function closeChatMenu() {
    document.getElementById('chatMenu').classList.add('hidden');
}

// ===== ПОДТВЕРЖДЕНИЯ =====
let confirmCallback = null;

function showConfirm(title, text, onYes) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmText').textContent = text;
    confirmCallback = onYes;
    document.getElementById('confirmModal').classList.remove('hidden');
}

function closeConfirm() {
    document.getElementById('confirmModal').classList.add('hidden');
    confirmCallback = null;
}

function doConfirm() {
    const cb = confirmCallback;
    closeConfirm();
    if (cb) cb();
}

// ===== ДЕЙСТВИЯ МЕНЮ =====
function confirmClearChat() {
    showConfirm('Очистить чат?', 'Все сообщения будут удалены у всех участников.', async () => {
        try {
            await api(`/api/rooms/${currentRoomId}/clear`, 'POST');
            await loadMessages(currentRoomId);
        } catch (e) {
            alert(e.message);
        }
    });
}

function confirmLeaveGroup() {
    showConfirm('Покинуть группу?', 'Вы больше не будете участником этой группы.', async () => {
         try {
            await api(`/api/groups/${currentGroup.id}/leave`, 'POST');
            showView('groups');
            loadGroups();
        } catch (e) {
            alert(e.message);
        }
    });
}

async function inviteToGroup() {
    const login = document.getElementById('inviteLogin').value.trim();
    if (!login || !currentGroup) return;
    try {
        await api(`/api/groups/${currentGroup.id}/invite`, 'POST', { login: login });
        document.getElementById('inviteLogin').value = '';
        await openGroupScreen(currentGroup.id);
    } catch (e) {
        alert(e.message);
    }
}

async function kickMember(userId) {
    if (!currentGroup) return;
    try {
        await api(`/api/groups/${currentGroup.id}/kick/${userId}`, 'POST');
        await openGroupScreen(currentGroup.id);
    } catch (e) {
        alert(e.message);
    }
}

async function setMemberRole(userId, role) {
    if (!currentGroup) return;
    try {
        await api(`/api/groups/${currentGroup.id}/role`, 'POST', { userId: userId, role: role });
        await openGroupScreen(currentGroup.id);
    } catch (e) {
        alert(e.message);
    }
}

function isCurrentRoomPrivate() {
    const room = rooms.find(r => r.id === currentRoomId);
    return room ? !room.isGroup : false;
}

function changeAvatar() {
    closeAvatarMenu();
    document.getElementById('avatarInput').click();
}

function confirmLogout() {
    document.getElementById('logoutModal').classList.remove('hidden');
}

function closeLogoutModal() {
    document.getElementById('logoutModal').classList.add('hidden');
}

        function toggleMenu() {
    const menu = document.getElementById('sideMenu');
    menu.classList.toggle('open');
} 

        async function registerUser() {
    try {
        const result = await api('/api/register', 'POST', {
            login: document.getElementById('regLogin').value,
            name: document.getElementById('regName').value,
            password: document.getElementById('regPassword').value
        });
        localStorage.setItem('myLogin', document.getElementById('regLogin').value.trim());
        await afterAuth(result);
        showView('chatsList'); // показываем чаты после регистрации
    } catch (e) {
        document.getElementById('regError').textContent = e.message;
    }
}

                async function loginUser() {
            try {
                const result = await api('/api/login', 'POST', {
                    login: document.getElementById('loginLogin').value,
                    password: document.getElementById('loginPassword').value
                });

                localStorage.setItem('myLogin', document.getElementById('loginLogin').value.trim());

                await afterAuth(result);

                // Восстанавливаем последний экран после логина
                const lastView = localStorage.getItem('lastView');
                if (lastView && lastView !== 'register' && lastView !== 'login') {
                    const lastRoomId = parseInt(localStorage.getItem('lastRoomId'));
                    const lastGroupId = parseInt(localStorage.getItem('lastGroupId'));

                    if (lastView === 'chat' && lastRoomId) {
                        const isGroupRoom = !rooms.some(r => r.id === lastRoomId);
                        if (isGroupRoom) {
                            await openGroupChatById(lastRoomId);
                        } else {
                            await selectRoom(lastRoomId);
                            showView('chat');
                        }
                    } else if (lastView === 'group' && lastGroupId) {
                        await openGroupScreen(lastGroupId);
                    } else if (lastView === 'feed') {
                        showView('feed');
                        loadFeed();
                    } else if (lastView === 'groups') {
                        showView('groups');
                        loadGroups();
                    } else if (lastView === 'profile') {
                        showView('section');
                        document.getElementById('sectionTitle').textContent = 'Мой профиль';
                        document.getElementById('profileScreen').classList.remove('hidden');
                        document.getElementById('genericSection').classList.add('hidden');
                        fillProfile();
                    } else if (lastView === 'friends') {
                        showView('friends');
                        loadFriends();
                        loadFriendRequests();
                    } else {
                        showView('chatsList');
                    }
                } else {
                    showView('chatsList');
                }
            } catch (e) {
                document.getElementById('loginError').textContent = e.message;
            }
        }

        async function afterAuth(data) {
                    try{
            currentUserId = data.id;
            currentName = data.name;
            currentAvatar = data.avatarUrl;
            currentStatus = data.status || '';
            currentStreak = data.streak || 0;
            currentBestStreak = data.bestStreak || 0;
            currentUserLogin = localStorage.getItem('myLogin') || '';

            console.log('AUTH DATA:', data);

            setHeaderAvatar();
            renderRooms();
            fillPreviews();

            if (!connection) {
                connection = new signalR.HubConnectionBuilder()
                    .withUrl('/chathub')
                    .withAutomaticReconnect()
                    .build();

                                                connection.on('receive', (m) => {
                    addMessage(m);
                    const chatVisible = !document.getElementById('chatView').classList.contains('hidden');
                    if (m.userId !== currentUserId) {
                        playMessageSound();  // 🔊 звук на чужие сообщения
                    }
                    if (m.userId !== currentUserId && m.roomId === currentRoomId && chatVisible) {
                        markRoomRead(m.roomId);
                    } else if (m.userId !== currentUserId) {
                        unreadCounts[m.roomId] = (unreadCounts[m.roomId] || 0) + 1;
                        const row = document.querySelector(`.chat-row[data-room-id="${m.roomId}"]`);
                        if (row) applyUnreadBadge(row, m.roomId);
                        updateTitleBadge();  // 🔢 счётчик на вкладке
                        if (document.hidden) {
                            showBrowserNotification(m.name, m.text || '📷 Фото / 🎤 Голосовое');
                        }
                    }
                });

                connection.on('messagesread', (roomId) => {
                    if (roomId !== currentRoomId) return;
                    document.querySelectorAll('#messages .msg.own .ticks-wrap').forEach(t => {
                        t.innerHTML = ticksHtml(true);
                    });
                });

                connection.on('messagedeleted', (msgId, roomId) => {
                    if (roomId === currentRoomId) {
                        removeMessageFromDOM(msgId);
                    }
                });

                connection.on('roomschanged', () => {
                    loadRooms().then(() => fillPreviews());
                });

                connection.on('cleared', (roomId) => {
                    if (roomId === currentRoomId) {
                        loadMessages(roomId);
                    }
                });
                                connection.on('pinned', (roomId) => {
                    if (roomId === currentRoomId) updatePinnedBar();
                });

                                connection.on('pollcreated', (roomId) => {
                    if (roomId === currentRoomId) loadMessages(roomId);
                });
                connection.on('pollvoted', (roomId) => {
                    if (roomId === currentRoomId) refreshPolls();
                });
                                connection.on('presence', (userId, online) => {
                    if (online) onlineUsers.add(userId);
                    else onlineUsers.delete(userId);
                    updateOnlineUI(userId);
                });

                connection.on('typing', (userId, name) => {
                    if (userId === currentUserId) return;
                    const el = document.getElementById('headerStatus');
                    if (!el) return;
                    el.textContent = name + ' печатает...';
                    el.style.color = '#5b7cfa';
                    clearTimeout(typingTimer);
                    typingTimer = setTimeout(() => updateHeaderStatus(), 2000);
                });

                                connection.on('messagereacted', (msgId, reactions) => {
                    const row = document.querySelector(`[data-msg-id="${msgId}"]`);
                    if (!row) return;
                    let cont = row.querySelector('.msg-reactions');
                    if (!cont) {
                        cont = document.createElement('div');
                        cont.className = 'msg-reactions';
                        row.querySelector('.bubble').appendChild(cont);
                    }
                    renderReactionChips(cont, msgId, reactions);
                });

                                connection.on('messageedited', (msgId, newText, editedAt) => {
                    const row = document.querySelector(`[data-msg-id="${msgId}"]`);
                    if (!row) return;
                    const bubble = row.querySelector('.bubble');
                    const textEl = bubble.querySelector('.msg-text');
                    if (textEl) textEl.textContent = newText;
                    if (!bubble.querySelector('.msg-edited-label')) {
                        const lbl = document.createElement('span');
                        lbl.className = 'msg-edited-label';
                        lbl.textContent = 'изменено';
                        bubble.appendChild(lbl);
                    }
                });

            // После восстановления соединения — возвращаемся в открытый чат
               connection.onreconnected(async () => {
                   if (currentRoomId) {
                       await connection.invoke('JoinRoom', currentRoomId);
                   }
               });
                await connection.start();
            }

            await loadRooms();
                        try {
                const ids = await api('/api/users/online');
                ids.forEach(i => onlineUsers.add(i));
            } catch { }
                        // Загружаем друзей и заявки для бейджа
            await loadFriends();
            await loadFriendRequests();
                    console.log('afterAuth FINISHED OK');
    } catch (e) {
        console.error('afterAuth CRASHED:', e);
        alert('Ошибка: ' + e.message);
    }
}
        
        
    

        function setChatHeaderAvatar(room) {
    const av = document.getElementById('headerAvatar');
    av.innerHTML = '';

    if (room && room.otherUserId) {
        // ЛИЧНЫЙ ЧАТ — показываем СОБЕСЕДНИКА (аву или его букву)
        if (room.avatarUrl) {
            const img = document.createElement('img');
            img.src = room.avatarUrl;
            av.appendChild(img);
            av.dataset.uid = room.otherUserId;
            setOnlineDot(av, room.otherUserId);
        } else {
            av.textContent = (room.name || '?').charAt(0).toUpperCase();
        }
        av.setAttribute('onclick', `openUserCard(${room.otherUserId}, 'private')`);
        av.style.cursor = 'pointer';
    } else {
        // ОБЩИЙ ЧАТ — твоя ава (клик = заменить)
        if (currentAvatar) {
            const img = document.createElement('img');
            img.src = currentAvatar;
            av.appendChild(img);
        } else {
            av.textContent = (currentName || '?').charAt(0).toUpperCase();
        }
        av.setAttribute('onclick', "document.getElementById('avatarInput').click()");
        av.style.cursor = 'pointer';
    }
}

        function setHeaderAvatar() {
            const av = document.getElementById('headerAvatar');
            av.innerHTML = '';

            if (currentAvatar) {
                const img = document.createElement('img');
                img.src = currentAvatar;
                av.appendChild(img);
            } else {
                av.textContent = (currentName || '?').charAt(0).toUpperCase();
            }
        }

        async function uploadAvatar() {
            const input = document.getElementById('avatarInput');
            const file = input.files[0];

            if (!file) return;

            const fd = new FormData();
            fd.append('avatar', file);

            try {
                const res = await fetch('/api/avatar', {
                    method: 'POST',
                    body: fd,
                    credentials: 'same-origin'
                });

                const data = await res.json();

                if (!res.ok) {
                    alert(data.error || 'Не удалось загрузить аватар');
                    return;
                }
            currentAvatar = data.avatarUrl;
                setHeaderAvatar();

                                // Обновляем аву в профиле, если он открыт
                if (!document.getElementById('profileScreen').classList.contains('hidden')) {
                    fillProfile();
                }

                if (currentRoomId) {
                    await loadMessages(currentRoomId);
                }
            } catch {
                alert('Ошибка загрузки');
            }

            input.value = '';
        }

        async function loadRooms() {
    try {
        rooms = await api('/api/rooms') || [];
        renderRooms();
    } catch (e) {
        console.error('loadRooms error:', e);
        rooms = [];
    }
}
        
         
        async function fillPreviews() {
    try {
        const previews = await api('/api/rooms/previews');
        if (!previews) return;
        for (const p of previews) {
            const row = document.querySelector(`.chat-row[data-room-id="${p.roomId}"]`);
            if (!row) continue;

            const lastEl = row.querySelector('.chat-row-last');
            const timeEl = row.querySelector('.chat-row-time');

            if (p.last) {
                lastEl.textContent = (p.last.name ? p.last.name + ': ' : '') + (p.last.text || '');
                const t = p.last.sentAt;
                timeEl.textContent = t ? formatTime(t) : '';
                row.dataset.time = t ? new Date(t).getTime() : 0;
            } else {
                lastEl.textContent = 'Нет сообщений';
                row.dataset.time = 0;
            }

            if (typeof p.unread === 'number') unreadCounts[p.roomId] = p.unread;
            applyUnreadBadge(row, p.roomId);
        }
    } catch (e) { 
        console.error('fillPreviews error:', e);
    }
    sortChatsList();
}
        async function createRoom() {
            try {
                const name = document.getElementById('newRoomName').value;

                if (!name.trim()) return;

                const room = await api('/api/rooms', 'POST', { name });

                document.getElementById('newRoomName').value = '';
                document.getElementById('newRoomBar').classList.add('hidden');

                await loadRooms();
                await selectRoom(room.id);
            } catch (e) {
                alert(e.message);
            }
        }

        async function openChat(roomId) {
    await selectRoom(roomId);
    showView('chat');
}

function backToChatsList() {
    if (chatSource === 'groups') {
        showView('groups');
        loadGroups();
    } else {
        showView('chatsList');
        loadRooms().then(() => fillPreviews());
    }
}

 async function selectRoom(roomId) {
    if (!connection || currentRoomId === roomId) return;

    if (currentRoomId) {
        await connection.invoke('LeaveRoom', currentRoomId);
    }

    currentRoomId = roomId;

    await connection.invoke('JoinRoom', roomId);

    const room = rooms.find(r => r.id === roomId);

    // Нашли в списке личных чатов — значит это НЕ группа, сбрасываем флаг
    if (room) currentRoomIsGroup = false;

    // Название: для групп из currentGroup, для личных — имя друга
    document.getElementById('currentRoomTitle').textContent =
        currentRoomIsGroup && currentGroup ? currentGroup.name : (room ? room.name : 'Чат');

    if (!currentRoomIsGroup) {
        setChatHeaderAvatar(room);
                const pollBtn = document.getElementById('pollBtn');
        if (pollBtn) pollBtn.classList.add('hidden');
        const pb = document.getElementById('pinnedBar');
        if (pb) pb.classList.add('hidden');
    }

    await loadMessages(roomId);
    markRoomRead(roomId);
    unreadCounts[roomId] = 0;
    updateTitleBadge();
    const unreadRow = document.querySelector(`.chat-row[data-room-id="${roomId}"]`);
    if (unreadRow) applyUnreadBadge(unreadRow, roomId);
    renderRooms();
    localStorage.setItem('lastRoomId', roomId);
    updateHeaderStatus();
    updateDisappearingIndicator();
}

        async function loadMessages(roomId) {
    document.getElementById('messages').innerHTML = '';

    const [messages, polls] = await Promise.all([
        api(`/api/rooms/${roomId}/messages`),
        api(`/api/rooms/${roomId}/polls`).catch(() => [])
    ]);

    const items = [
        ...messages.map(m => ({ t: new Date(m.sentAt).getTime(), kind: 'msg', data: m })),
        ...polls.map(p => ({ t: new Date(p.createdAt).getTime(), kind: 'poll', data: p }))
    ].sort((a, b) => a.t - b.t);

    items.forEach(it => it.kind === 'msg' ? addMessage(it.data) : addPollCard(it.data));
}
function ticksHtml(read) {
    if (read) {
        return '<svg class="msg-ticks read" width="16" height="12" viewBox="0 0 18 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6.5l4 4L13 2"></path><path d="M8 10.5l1.5 1.5L17 2"></path></svg>';
    }
    return '<svg class="msg-ticks" width="14" height="12" viewBox="0 0 14 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6.5l4 4L13 2"></path></svg>';
}

async function markRoomRead(roomId) {
    try {
        await api(`/api/rooms/${roomId}/read`, 'POST');
    } catch { }
}
        function addMessage(m) {
    const list = document.getElementById('messages');

    const row = document.createElement('div');
    row.className = 'msg' + (m.userId === currentUserId ? ' own' : '');

    const av = document.createElement('div');
    av.className = 'avatar';
    if (m.userId !== currentUserId) {
        const ctx = isCurrentRoomPrivate() ? 'private' : 'group';
        av.onclick = () => openUserCard(m.userId, ctx);
        av.dataset.uid = m.userId;
        setOnlineDot(av, m.userId);
        av.style.cursor = 'pointer';
    }

    if (m.avatarUrl) {
        const img = document.createElement('img');
        img.src = m.avatarUrl;
        av.appendChild(img);
    } else {
        av.textContent = (m.name || '?').charAt(0).toUpperCase();
    }

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

        // Плашка ответа
    if (m.replyToId) {
        const rp = document.createElement('div');
        rp.className = 'msg-reply-preview';
        rp.onclick = () => scrollToMessage(m.replyToId);
        const rpName = document.createElement('div');
        rpName.className = 'msg-reply-preview-name';
        rpName.textContent = m.replyAuthorName || 'Ответ';
        const rpText = document.createElement('div');
        rpText.className = 'msg-reply-preview-text';
        rpText.textContent = m.replyText || '';
        rp.appendChild(rpName);
        rp.appendChild(rpText);
        bubble.appendChild(rp);
    }

    const nameEl = document.createElement('div');
    nameEl.className = 'msg-name';
    nameEl.textContent = m.name;

    const textEl = document.createElement('div');
    textEl.className = 'msg-text';
    textEl.textContent = m.text;

        bubble.appendChild(nameEl);
    bubble.appendChild(textEl);

    // Фото в сообщении
    if (m.imageUrl) {
        const img = document.createElement('img');
        img.className = 'msg-image';
        img.src = m.imageUrl;
        img.onclick = () => viewChatImage(m.imageUrl);
        bubble.appendChild(img);
    }
    // Голосовое сообщение
    if (m.audioUrl) {
        const audio = document.createElement('div');
        audio.className = 'msg-audio';
        
        const playBtn = document.createElement('button');
        playBtn.className = 'msg-audio-play';
        playBtn.textContent = '▶';
        
        const info = document.createElement('div');
        info.className = 'msg-audio-info';
        
        const title = document.createElement('div');
        title.className = 'msg-audio-title';
        title.textContent = '🎤 Голосовое сообщение';
        
        const wave = document.createElement('div');
        wave.className = 'msg-audio-wave';
        for (let i = 0; i < 12; i++) {
            const bar = document.createElement('span');
            bar.style.height = (15 + Math.random() * 85) + '%';
            wave.appendChild(bar);
        }
        
        const time = document.createElement('div');
        time.className = 'msg-audio-time';
        time.textContent = '0:00';
        
        info.appendChild(title);
        info.appendChild(wave);
        info.appendChild(time);
        
        audio.appendChild(playBtn);
        audio.appendChild(info);
        
        const audioEl = new Audio(m.audioUrl);
        let isPlaying = false;
        
        playBtn.onclick = () => {
            if (isPlaying) {
                audioEl.pause();
                audioEl.currentTime = 0;
                playBtn.textContent = '▶';
                wave.classList.remove('playing');
                isPlaying = false;
            } else {
                audioEl.play();
                playBtn.textContent = '⏸';
                wave.classList.add('playing');
                isPlaying = true;
            }
        };
        
        audioEl.onended = () => {
            playBtn.textContent = '▶';
            wave.classList.remove('playing');
            isPlaying = false;
        };
        
        audioEl.ontimeupdate = () => {
            const m = Math.floor(audioEl.currentTime / 60);
            const s = Math.floor(audioEl.currentTime % 60);
            time.textContent = m + ':' + String(s).padStart(2, '0');
        };
        
        bubble.appendChild(audio);
    }

        // Видео-кружок
    if (m.videoUrl) {
        const vid = document.createElement('video');
        vid.className = 'msg-video-circle';
        vid.src = m.videoUrl;
        vid.playsInline = true;
        vid.loop = true;
        vid.onclick = () => {
            if (vid.paused) vid.play(); else vid.pause();
        };
        bubble.appendChild(vid);
    }

    if (m.EditedAt) {
        const lbl = document.createElement('span');
        lbl.className = 'msg-edited-label';
        lbl.textContent = 'изменено';
        bubble.appendChild(lbl);
    }

        // Пересланное сообщение
    if (m.forwardedFromName) {
        const fwd = document.createElement('div');
        fwd.className = 'msg-forwarded';
        fwd.textContent = '↪️ Переслано от ' + m.forwardedFromName;
        bubble.appendChild(fwd);
    }

    // Галочки у своих сообщений
    if (m.userId === currentUserId) {
        const ticks = document.createElement('span');
        ticks.className = 'ticks-wrap';
        ticks.innerHTML = ticksHtml(m.isRead);
        bubble.appendChild(ticks);
    }
    
        // Реакции под сообщением
    const reactCont = document.createElement('div');
    reactCont.className = 'msg-reactions';
    bubble.appendChild(reactCont);
    renderReactionChips(reactCont, m.id, m.reactions);

    row.appendChild(av);
    row.appendChild(bubble);

               // Три точки на ВСЕХ сообщениях
    if (m.id) {
        const menu = document.createElement('button');
        menu.className = 'msg-menu-btn';
        menu.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>';
        menu.onclick = (e) => {
            e.stopPropagation();
            openMessageMenu(e, m);
        };
        row.appendChild(menu);
    }
    // Таймер исчезновения
    if (m.expiresAt) scheduleExpire(m.id, m.expiresAt);
    row.dataset.msgId = m.id;
    list.appendChild(row);
    list.scrollTop = list.scrollHeight;
}

        async function sendMessage() {

    const input = document.getElementById('messageText');
    const text = input.value;

    // Проверяем что есть ЧТО отправлять (текст, ИЛИ фото, ИЛИ аудио)
        if (!text.trim() && !chatImageUrl && !chatImageFile && !currentAudioUrl && !currentVideoUrl) return;
    if (!connection || !currentRoomId) return;

    // Если в режиме редактирования — отправляем PUT (только текст)
    if (editingMessage) {
        try {
            await api(`/api/messages/${editingMessage.id}`, 'PUT', { text: text.trim() });
            input.value = '';
            cancelEdit();
            updateVoiceButtonVisibility();
        } catch (e) {
            alert(e.message || 'Не удалось сохранить');
        }
        return;
    }

    // Загружаем фото если есть
    let finalImageUrl = chatImageUrl;
    if (chatImageFile && !finalImageUrl) {
        try {
            const fd = new FormData();
            fd.append('image', chatImageFile);
            const res = await fetch('/api/chatimage', {
                method: 'POST',
                body: fd,
                credentials: 'same-origin'
            });
                        if (!res.ok) {
                let msg = 'Не удалось загрузить фото';
                try { const d = await res.json(); if (d.error) msg = d.error; } catch { }
                throw new Error(msg);
            }
            const data = await res.json();
            finalImageUrl = data.imageUrl;
        } catch (e) {
            alert(e.message);
            return;
        }
    }

    // Аудио уже загружено (currentAudioUrl) или null
    const finalAudioUrl = currentAudioUrl || null;
    const finalVideoUrl = currentVideoUrl || null;
    // Отправляем через SignalR со ВСЕМИ параметрами
    try {
        const replyId = replyTo ? replyTo.id : null;
        await connection.invoke('SendMessage', 
            currentRoomId, 
            text.trim(), 
            replyId, 
            finalImageUrl, 
            finalAudioUrl,
            finalVideoUrl
        );
        
        // Очищаем всё после отправки
        input.value = '';
        cancelReply();
        removeChatImage();
        currentAudioUrl = null;
        currentVideoUrl = null;
        updateVoiceButtonVisibility();
    } catch (e) {
        alert('Не удалось отправить: ' + (e.message || 'проверь соединение'));
    }
}

        // ===== МЕНЮ СООБЩЕНИЯ =====
function openMessageMenu(e, m) {
    const menu = document.getElementById('chatMenu');
    if (!menu.classList.contains('hidden')) {
        closeChatMenu();
        return;
    }
    menu.innerHTML = '';

    // Удалить у себя — всегда
    addChatMenuItem(menu, 'Удалить', () => {
        closeChatMenu();
        deleteMessage(m.id);
    });

    // Ответить — ВСЕМ на любые сообщения
    addChatMenuItem(menu, '↩️ Ответить', () => {
        closeChatMenu();
        startReply(m);
    });

    // Редактирование — только своё
    if (m.userId === currentUserId) {
        addChatMenuItem(menu, '✏️ Редактировать', () => {
            closeChatMenu();
            startEditInInput(m);
        });
    }

    // Пересылка — для ВСЕХ сообщений (без условия!)
    addChatMenuItem(menu, '↪️ Переслать', () => {
        closeChatMenu();
        openForwardModal(m.id);
    });

    // Закреп — только админ/модер в группе
    if (currentRoomIsGroup && currentGroup && (currentGroup.myRole === 'admin' || currentGroup.myRole === 'moder')) {
        addChatMenuItem(menu, '📌 Закрепить', () => {
            closeChatMenu();
            pinMessage(m.id);
        });
    }

    const rect = e.currentTarget.getBoundingClientRect();
    menu.classList.remove('hidden');

    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    let left = rect.left - mw - 4;
    let top = rect.top;
    if (left < 10) left = rect.right + 4;
    if (top + mh > window.innerHeight - 10) top = rect.top - mh + rect.height;

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
}

let pendingDeleteMsgId = null;

async function deleteMessage(msgId, forAll) {
    pendingDeleteMsgId = msgId;
    
    // Если это своё сообщение — показываем модалку с чекбоксом
    const msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (msgEl && msgEl.classList.contains('own')) {
        document.getElementById('deleteForAllCheckbox').checked = false;
        document.getElementById('deleteMessageModal').classList.remove('hidden');
        return;
    }
    
    // Чужое сообщение — удаляем только у себя
    try {
        await connection.invoke('DeleteMessage', msgId, false);
        removeMessageFromDOM(msgId);
    } catch (e) {
        alert('Не удалось удалить сообщение');
    }
}

async function confirmDeleteMessage() {
    if (!pendingDeleteMsgId) return;
    
    const forAll = document.getElementById('deleteForAllCheckbox').checked;
    
    try {
        await connection.invoke('DeleteMessage', pendingDeleteMsgId, forAll);
        removeMessageFromDOM(pendingDeleteMsgId);
        closeDeleteMessageModal();
    } catch (e) {
        alert('Не удалось удалить сообщение');
    }
}

function closeDeleteMessageModal() {
    document.getElementById('deleteMessageModal').classList.add('hidden');
    pendingDeleteMsgId = null;
}

function removeMessageFromDOM(msgId) {
    const el = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (el) {
        el.style.transition = 'opacity 0.3s, transform 0.3s';
        el.style.opacity = '0';
        el.style.transform = 'translateX(20px)';
        setTimeout(() => el.remove(), 300);
    }
}

async function findAndChat() {
    const login = document.getElementById('searchLogin').value.trim();
    if (!login) return;

    const room = await connection.invoke('StartDirectChatByLogin', login);

        if (room) {
        document.getElementById('searchLogin').value = '';
        closeSearchModal();
        await loadRooms();
        await selectRoom(room.id);
        chatSource = 'chats';
        showView('chat');
    } else {
        alert('Пользователь не найден');
    }
}
function openSearchModal() {
    document.getElementById('searchModal').classList.remove('hidden');
}

function closeSearchModal() {
    document.getElementById('searchModal').classList.add('hidden');
}
        window.onload = async () => {
    try {
        const me = await api('/api/me');
        await afterAuth(me);

        // Восстанавливаем последний экран
        const lastView = localStorage.getItem('lastView');
        const lastRoomId = parseInt(localStorage.getItem('lastRoomId'));
        const lastGroupId = parseInt(localStorage.getItem('lastGroupId'));

        if (lastView === 'chat' && lastRoomId) {
            // Если это чат группы — открываем как группу
            const isGroupRoom = !rooms.some(r => r.id === lastRoomId);
            if (isGroupRoom) {
                await openGroupChatById(lastRoomId);
            } else {
                await selectRoom(lastRoomId);
                showView('chat');
            }
        } else if (lastView === 'group' && lastGroupId) {
            await openGroupScreen(lastGroupId);
        } else if (lastView === 'feed') {
            showView('feed');
            loadFeed();
        } else if (lastView === 'groups') {
            showView('groups');
            loadGroups();
                } else if (lastView === 'profile') {
            showView('section');
            document.getElementById('sectionTitle').textContent = 'Мой профиль';
            document.getElementById('profileScreen').classList.remove('hidden');
            document.getElementById('genericSection').classList.add('hidden');
            fillProfile();
        } else if (lastView === 'friends') {
            showView('friends');
            loadFriends();
            loadFriendRequests();
        } else {
            showView('chatsList');
        }
    } catch {
        localStorage.removeItem('lastView');
        showView('register');
    }
};
// ===== СПИСОК ЧАТОВ (рендер) =====
function renderRooms() {
    const wrap = document.getElementById('chatsList');
    if (!wrap) return;
    wrap.innerHTML = '';

    const sorted = [...rooms].sort((a, b) => {
        if (a.name === 'Общий') return -1;
        if (b.name === 'Общий') return 1;
        return 0;
    });

    sorted.forEach(room => {
        const row = document.createElement('div');
        row.className = 'chat-row';
        row.onclick = () => { chatSource = 'chats'; openChat(room.id); };
        row.dataset.roomId = room.id;

        const avatar = document.createElement('div');
        avatar.className = 'chat-row-avatar';
        if (room.avatarUrl) {
            const img = document.createElement('img');
            img.src = room.avatarUrl;
            avatar.appendChild(img);
        } else {
            avatar.textContent = room.name === 'Общий' ? '🌐' : room.name.charAt(0).toUpperCase();
        }

                if (room.otherUserId) {
            avatar.dataset.uid = room.otherUserId;
            setOnlineDot(avatar, room.otherUserId);
        }

        const info = document.createElement('div');
        info.className = 'chat-row-info';
        const name = document.createElement('div');
        name.className = 'chat-row-name';
        name.textContent = room.name;
        const last = document.createElement('div');
        last.className = 'chat-row-last';
        last.textContent = '';
        info.appendChild(name);
        info.appendChild(last);

        const time = document.createElement('div');
        time.className = 'chat-row-time';
        time.textContent = '';

        const badge = document.createElement('div');
        badge.className = 'chat-row-unread hidden';

        row.appendChild(avatar);
        row.appendChild(info);
        row.appendChild(time);
        row.appendChild(badge);
        applyUnreadBadge(row, room.id);
        wrap.appendChild(row);
    });
}

function sortChatsList() {
    const wrap = document.getElementById('chatsList');
    if (!wrap) return;
    const rows = Array.from(wrap.children);
    rows.sort((a, b) => {
        const an = a.querySelector('.chat-row-name').textContent;
        const bn = b.querySelector('.chat-row-name').textContent;
        if (an === 'Общий') return -1;
        if (bn === 'Общий') return 1;
        return (Number(b.dataset.time) || 0) - (Number(a.dataset.time) || 0);
    });
    rows.forEach(r => wrap.appendChild(r));
}

function formatTime(t) {
    const d = new Date(t);
    if (isNaN(d)) return '';
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0');
}

async function logout() {
    try {
        await api('/api/logout', 'POST');
    } catch { }
    localStorage.removeItem('lastView');
    localStorage.removeItem('lastRoomId');
    localStorage.removeItem('lastGroupId');
    location.reload();
}


// ===== ЗАКРЕП СООБЩЕНИЯ =====
async function updatePinnedBar() {
    const bar = document.getElementById('pinnedBar');
    if (!bar) return;
    if (!currentRoomIsGroup || !currentGroup) { bar.classList.add('hidden'); return; }
    try {
        const g = await api(`/api/groups/${currentGroup.id}`);
        currentGroup = g;
        if (g.pinned) {
            document.getElementById('pinnedText').textContent = `${g.pinned.name}: ${g.pinned.text}`;
            bar.classList.remove('hidden');
            const canUnpin = g.myRole === 'admin' || g.myRole === 'moder';
            document.getElementById('pinnedClose').classList.toggle('hidden', !canUnpin);
        } else {
            bar.classList.add('hidden');
        }
    } catch {
        bar.classList.add('hidden');
    }
}

async function pinMessage(msgId) {
    if (!currentGroup) return;
    try {
        await api(`/api/groups/${currentGroup.id}/pin`, 'POST', { messageId: msgId });
        await updatePinnedBar();
    } catch (e) { alert(e.message); }
}

async function unpinMessage() {
    if (!currentGroup) return;
    try {
        await api(`/api/groups/${currentGroup.id}/pin`, 'POST', { messageId: 0 });
        await updatePinnedBar();
    } catch (e) { alert(e.message); }
}

function scrollToPinned() {
    if (!currentGroup || !currentGroup.pinned) return;
    const el = document.querySelector(`[data-msg-id="${currentGroup.pinned.id}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ===== ОПРОСЫ =====
function buildPollCard(p) {
    const card = document.createElement('div');
    card.className = 'poll-card';
    card.dataset.pollId = p.id;

    const q = document.createElement('div');
    q.className = 'poll-question';
    q.textContent = '📊 ' + p.question;
    card.appendChild(q);

    p.options.forEach(o => {
        const pct = p.totalVotes > 0 ? Math.round((o.votes / p.totalVotes) * 100) : 0;
        const opt = document.createElement('div');
        opt.className = 'poll-option' + (p.myVote === o.id ? ' voted' : '');
        opt.onclick = () => votePoll(p.id, o.id);

        const fill = document.createElement('div');
        fill.className = 'poll-option-fill';
        fill.style.width = pct + '%';

        const row = document.createElement('div');
        row.className = 'poll-option-row';
        const txt = document.createElement('span');
        txt.className = 'poll-option-text';
        txt.textContent = o.text;
        const pc = document.createElement('span');
        pc.className = 'poll-option-pct';
        pc.textContent = pct + '%';
        row.appendChild(txt);
        row.appendChild(pc);

        opt.appendChild(fill);
        opt.appendChild(row);
        card.appendChild(opt);
    });

    const total = document.createElement('div');
    total.className = 'poll-total';
    total.textContent = 'Голосов: ' + p.totalVotes;
    card.appendChild(total);

    return card;
}

function addPollCard(p) {
    const list = document.getElementById('messages');
    list.appendChild(buildPollCard(p));
    list.scrollTop = list.scrollHeight;
}

async function votePoll(pollId, optionId) {
    try {
        await api(`/api/polls/${pollId}/vote`, 'POST', { optionId });
        await refreshPolls();
    } catch (e) { alert(e.message); }
}

async function refreshPolls() {
    if (!currentRoomId) return;
    try {
        const polls = await api(`/api/rooms/${currentRoomId}/polls`);
        polls.forEach(p => {
            const old = document.querySelector(`.poll-card[data-poll-id="${p.id}"]`);
            if (old) old.replaceWith(buildPollCard(p));
        });
    } catch { }
}

function openCreatePollModal() {
    document.getElementById('pollQuestion').value = '';
    document.getElementById('pollOptionsList').innerHTML = '';
    addPollOptionInput();
    addPollOptionInput();
    document.getElementById('createPollModal').classList.remove('hidden');
}

function closeCreatePollModal() {
    document.getElementById('createPollModal').classList.add('hidden');
}

function addPollOptionInput() {
    const list = document.getElementById('pollOptionsList');
    if (list.children.length >= 8) return;
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'group-input';
    inp.placeholder = 'Вариант ' + (list.children.length + 1);
    inp.style.marginTop = '8px';
    list.appendChild(inp);
}

async function createPoll() {
    const q = document.getElementById('pollQuestion').value.trim();
    const opts = Array.from(document.querySelectorAll('#pollOptionsList input'))
        .map(i => i.value.trim()).filter(v => v);
    if (!q) { alert('Введите вопрос'); return; }
    if (opts.length < 2) { alert('Минимум 2 варианта'); return; }
    try {
        await api(`/api/rooms/${currentRoomId}/polls`, 'POST', { question: q, options: opts });
        closeCreatePollModal();
    } catch (e) { alert(e.message); }
}

// ===== ОТВЕТ НА СООБЩЕНИЕ =====
function startReply(m) {
    replyTo = { id: m.id, name: m.name, text: m.text };
    document.getElementById('replyBarName').textContent = m.name;
    document.getElementById('replyBarText').textContent = m.text;
    document.getElementById('replyBar').classList.remove('hidden');
    document.getElementById('messageText').focus();
}

function cancelReply() {
    replyTo = null;
    document.getElementById('replyBar').classList.add('hidden');
}

async function scrollToMessage(msgId) {
    let el = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (!el) {
        // Если сообщение не загружено — пробуем найти в истории
        try {
            const messages = await api(`/api/rooms/${currentRoomId}/messages`);
            if (!messages.find(m => m.id === msgId)) return;
            // Перезагружаем и снова ищем
            await loadMessages(currentRoomId);
            el = document.querySelector(`[data-msg-id="${msgId}"]`);
        } catch { return; }
    }
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'background .3s';
        el.style.background = 'rgba(91,124,250,0.15)';
        setTimeout(() => { el.style.background = ''; }, 1500);
    }
}

// ===== ОНЛАЙН-СТАТУСЫ =====
const onlineUsers = new Set();
let typingTimer = null;
let lastTypingSent = 0;

function setOnlineDot(avEl, userId) {
    if (!avEl) return;
    avEl.style.position = 'relative';
    let dot = avEl.querySelector('.online-dot');
    if (onlineUsers.has(userId)) {
        if (!dot) {
            dot = document.createElement('span');
            dot.className = 'online-dot';
            avEl.appendChild(dot);
        }
    } else if (dot) {
        dot.remove();
    }
}

function updateOnlineUI(userId) {
    document.querySelectorAll(`[data-uid="${userId}"]`).forEach(el => setOnlineDot(el, userId));
    updateHeaderStatus();
}

function updateHeaderStatus() {
    const el = document.getElementById('headerStatus');
    if (!el) return;
    const sec = currentDisappearingSeconds();
    const disText = sec > 0 ? '⏳ ' + formatDisappearing(sec) : '';

    if (currentRoomIsGroup) {
        el.textContent = disText;
        el.style.color = '#5b7cfa';
        return;
    }
    const room = rooms.find(r => r.id === currentRoomId);
    if (room && room.otherUserId) {
        const online = onlineUsers.has(room.otherUserId);
        let text = online ? 'в сети' : 'не в сети';
        if (disText) text += ' · ' + disText;
        el.textContent = text;
        el.style.color = online ? '#34c759' : '#8a8a8e';
    } else {
        el.textContent = disText;
        el.style.color = '#5b7cfa';
    }
}

function onTyping() {
    const now = Date.now();
    if (now - lastTypingSent > 1500 && connection && currentRoomId) {
        lastTypingSent = now;
        connection.invoke('Typing', currentRoomId).catch(() => {});
    }
}

// ===== НЕПРОЧИТАННЫЕ СЧЁТЧИКИ =====
function applyUnreadBadge(row, roomId) {
    const badge = row.querySelector('.chat-row-unread');
    if (!badge) return;
    const n = unreadCounts[roomId] || 0;
    if (n > 0) {
        badge.textContent = n > 99 ? '99+' : n;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// ===== РЕАКЦИИ НА СООБЩЕНИЯ =====
async function reactToMessage(msgId, emoji) {
    try {
        const res = await api(`/api/messages/${msgId}/react`, 'POST', { emoji });
        const row = document.querySelector(`[data-msg-id="${msgId}"]`);
        if (row) {
            let cont = row.querySelector('.msg-reactions');
            if (!cont) {
                cont = document.createElement('div');
                cont.className = 'msg-reactions';
                row.querySelector('.bubble').appendChild(cont);
            }
            renderReactionChips(cont, msgId, res.reactions);
        }
    } catch (e) { alert(e.message); }
}

function renderReactionChips(container, msgId, reactions) {
    container.innerHTML = '';
    if (!reactions || reactions.length === 0) {
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');
    reactions.forEach(r => {
        const chip = document.createElement('button');
        chip.className = 'msg-reaction' + (r.mine ? ' mine' : '');
        chip.textContent = `${r.emoji} ${r.count}`;
        chip.onclick = () => reactToMessage(msgId, r.emoji);
        container.appendChild(chip);
    });
}

// ===== РЕДАКТИРОВАНИЕ СООБЩЕНИЙ (в стиле Telegram) =====
function startEditInInput(m) {
    editingMessage = { id: m.id, text: m.text };
    document.getElementById('editBarText').textContent = m.text;
    document.getElementById('editBar').classList.remove('hidden');
    
    const input = document.getElementById('messageText');
    input.value = m.text;
    input.focus();
    input.setSelectionRange(0, m.text.length);
    
    // Меняем кнопку отправки на ✓
    const sendBtn = document.querySelector('.send-btn');
    if (sendBtn) {
        sendBtn.classList.add('editing');
        sendBtn.textContent = '✓';
    }
}

function cancelEdit() {
    editingMessage = null;
    document.getElementById('editBar').classList.add('hidden');
    document.getElementById('messageText').value = '';
    
    const sendBtn = document.querySelector('.send-btn');
    if (sendBtn) {
        sendBtn.classList.remove('editing');
        sendBtn.textContent = '➤';
    }
}

// ===== ПЕРЕСЫЛКА СООБЩЕНИЙ =====
let forwardingMessageId = null;

async function openForwardModal(msgId) {
    forwardingMessageId = msgId;
    const list = document.getElementById('forwardRoomsList');
    list.innerHTML = '<div style="text-align:center;padding:20px;color:#8a8a8e;">Загрузка...</div>';
    document.getElementById('forwardModal').classList.remove('hidden');

    try {
        const rooms = await api('/api/rooms');
        list.innerHTML = '';
        
        if (rooms.length === 0) {
            list.innerHTML = '<div style="text-align:center;padding:20px;color:#8a8a8e;">Нет доступных чатов</div>';
            return;
        }

        rooms.forEach(room => {
            const row = document.createElement('div');
            row.className = 'forward-room-row';
            row.onclick = () => forwardMessage(room.id);

            const av = document.createElement('div');
            av.className = 'forward-room-avatar';
            if (room.avatarUrl) {
                const img = document.createElement('img');
                img.src = room.avatarUrl;
                av.appendChild(img);
            } else {
                av.textContent = room.name === 'Общий' ? '🌐' : room.name.charAt(0).toUpperCase();
            }

            const info = document.createElement('div');
            info.className = 'forward-room-info';
            const name = document.createElement('div');
            name.className = 'forward-room-name';
            name.textContent = room.name;
            info.appendChild(name);

            row.appendChild(av);
            row.appendChild(info);
            list.appendChild(row);
        });
    } catch (e) {
        list.innerHTML = '<div style="text-align:center;padding:20px;color:#e74c3c;">Ошибка загрузки</div>';
    }
}

function closeForwardModal() {
    document.getElementById('forwardModal').classList.add('hidden');
    forwardingMessageId = null;
}

async function forwardMessage(targetRoomId) {
    if (!forwardingMessageId) return;
    try {
        await api(`/api/messages/${forwardingMessageId}/forward`, 'POST', { roomId: targetRoomId });
        closeForwardModal();
        alert('Сообщение переслано!');
    } catch (e) {
        alert(e.message || 'Не удалось переслать');
    }
}

function currentDisappearingSeconds() {
    if (currentRoomIsGroup && currentGroup) return currentGroup.disappearingSeconds || 0;
    const room = rooms.find(r => r.id === currentRoomId);
    return room ? (room.disappearingSeconds || 0) : 0;
}

function formatDisappearing(sec) {
    if (sec < 60) return sec + ' сек';
    return Math.round(sec / 60) + ' мин';
}

function updateDisappearingIndicator() {
    const ind = document.getElementById('disappearingIndicator');
    const txt = document.getElementById('disappearingIndicatorText');
    if (!ind) return;
    const sec = currentDisappearingSeconds();
    if (sec > 0) {
        txt.textContent = formatDisappearing(sec);
        ind.classList.remove('hidden');
    } else {
        ind.classList.add('hidden');
    }
}

function scheduleExpire(msgId, expiresAt) {
    const delay = new Date(expiresAt).getTime() - Date.now();
    if (delay <= 0) {
        expireMessage(msgId);
        return;
    }
    setTimeout(() => expireMessage(msgId), delay);
}

async function expireMessage(msgId) {
    removeMessageFromDOM(msgId);
    try { await api(`/api/messages/${msgId}/expire`, 'POST'); } catch { }
}

function openDisappearingModal() {
    const wrap = document.getElementById('disappearingOptions');
    wrap.innerHTML = '';
    const options = [
        { label: 'Выключено', sec: 0 },
        { label: '5 секунд', sec: 5 },
        { label: '30 секунд', sec: 30 },
        { label: '1 минута', sec: 60 },
        { label: '5 минут', sec: 300 }
    ];
    const current = currentDisappearingSeconds();
    options.forEach(o => {
        const b = document.createElement('button');
        b.className = 'disappearing-option' + (current === o.sec ? ' active' : '');
        b.textContent = o.label;
        b.onclick = async () => {
            try {
                await api(`/api/rooms/${currentRoomId}/disappearing`, 'POST', { seconds: o.sec });
                if (currentRoomIsGroup && currentGroup) currentGroup.disappearingSeconds = o.sec;
                else {
                    const room = rooms.find(r => r.id === currentRoomId);
                    if (room) room.disappearingSeconds = o.sec;
                }
                closeDisappearingModal();
                updateDisappearingIndicator();
                updateHeaderStatus();
            } catch (e) { alert(e.message); }
        };
        wrap.appendChild(b);
    });
    document.getElementById('disappearingModal').classList.remove('hidden');
}

function closeDisappearingModal() {
    document.getElementById('disappearingModal').classList.add('hidden');
}


// ===== ФОТО В ЧАТЕ =====
function previewChatImage() {
    const input = document.getElementById('chatImageInput');
    const file = input.files[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
        alert('Файл слишком большой (макс 8 МБ)');
        input.value = '';
        return;
    }

    chatImageFile = file;
    chatImageUrl = null;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('chatPreviewImg').src = e.target.result;
        document.getElementById('chatImagePreview').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
    input.value = '';
}

function removeChatImage() {
    chatImageFile = null;
    chatImageUrl = null;
    document.getElementById('chatImagePreview').classList.add('hidden');
    document.getElementById('chatPreviewImg').src = '';
}

function viewChatImage(url) {
    const overlay = document.createElement('div');
    overlay.className = 'image-view-overlay';
    overlay.onclick = () => overlay.remove();
    const img = document.createElement('img');
    img.src = url;
    overlay.appendChild(img);
    document.body.appendChild(overlay);
}

// ===== ГОЛОСОВЫЕ СООБЩЕНИЯ =====
function updateVoiceButtonVisibility() {
    const input = document.getElementById('messageText');
    const sendBtn = document.getElementById('sendBtn');
    const voiceBtn = document.getElementById('voiceBtn');
    const videoBtn = document.getElementById('videoBtn');
    
    if (!sendBtn || !voiceBtn) return;
    
    const recBar = document.getElementById('inputBarRecording');
    if (recBar && !recBar.classList.contains('hidden')) return;
    
    const hasContent = input && input.value.trim().length > 0;
    const hasMedia = chatImageFile || chatImageUrl || currentAudioUrl || currentVideoUrl;
    
    if (!hasContent && !hasMedia) {
        voiceBtn.classList.remove('hidden');
        if (videoBtn) videoBtn.classList.remove('hidden');
        sendBtn.classList.add('hidden');
    } else {
        voiceBtn.classList.add('hidden');
        if (videoBtn) videoBtn.classList.add('hidden');
        sendBtn.classList.remove('hidden');
    }
}

(function initVoice() {
    const input = document.getElementById('messageText');
    if (input) {
        input.addEventListener('input', updateVoiceButtonVisibility);
    }
    updateVoiceButtonVisibility();
})();

async function toggleRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        stopRecording();
    } else {
        await startRecording();
    }
}

async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('🎤 Микрофон работает только по HTTPS!\n\nОткрой сайт через https-ссылку (cloudflared) — тогда голосовые заработают.');
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        const amime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        mediaRecorder = new MediaRecorder(stream, { mimeType: amime });
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };
        
        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            const audioBlob = new Blob(audioChunks, { type: amime });
            
            if (audioBlob.size < 5000) {
                finishRecording();
                return;
            }
            
            try {
                const fd = new FormData();
                fd.append('audio', audioBlob, amime.includes('mp4') ? 'voice.mp4' : 'voice.webm');
                const res = await fetch('/api/chataudio', {
                    method: 'POST',
                    body: fd,
                    credentials: 'same-origin'
                });
                if (!res.ok) throw new Error('Не удалось загрузить');
                const data = await res.json();
                currentAudioUrl = data.audioUrl;
                finishRecording();
                await sendMessage();
            } catch (e) {
                alert(e.message);
                finishRecording();
            }
        };
        
        mediaRecorder.start();
        recordingKind = 'audio';
        recordingSeconds = 0;
        
        // Показываем режим записи внутри input-bar
        document.getElementById('inputBarContent').classList.add('hidden');
        document.getElementById('inputBarRecording').classList.remove('hidden');
        
        updateRecordingTime();
        recordingTimer = setInterval(() => {
            recordingSeconds++;
            updateRecordingTime();
            if (recordingSeconds >= 60) stopRecording();
        }, 1000);
    } catch (e) {
        alert('Нет доступа к микрофону: ' + e.message);
    }
}

function updateRecordingTime() {
    const m = Math.floor(recordingSeconds / 60);
    const s = recordingSeconds % 60;
    const el = document.getElementById('recordingTime');
    if (el) el.textContent = m + ':' + String(s).padStart(2, '0');
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
}

function cancelRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        mediaRecorder = null;
        recordingKind = null;
    }
    audioChunks = [];
    finishRecording();
}

function finishRecording() {
    clearInterval(recordingTimer);
    mediaRecorder = null;
    audioChunks = [];
    recordingKind = null;
    
    // Возвращаем обычный режим input-bar
    document.getElementById('inputBarContent').classList.remove('hidden');
    document.getElementById('inputBarRecording').classList.add('hidden');
    
    // Обновляем видимость кнопок
    updateVoiceButtonVisibility();
}


// ===== ИСТОРИИ =====
let storyGroups = [];
let currentStoryGroup = 0;
let currentStoryItem = 0;
let storyTimer = null;
let storyProgressTimer = null;
let storyImageFile = null;
let storyBgColor = '#5b7cfa';

function esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}

async function loadStories() {
    const bar = document.getElementById('storiesBar');
    if (!bar) return;
    bar.innerHTML = '';

    try {
        storyGroups = await api('/api/stories');
    } catch (e) { storyGroups = []; }

    // Мой кружок — всегда первый
    const myGroup = storyGroups.find(g => g.isMe);
    const myCircle = document.createElement('div');
    myCircle.className = 'story-circle';
    myCircle.onclick = () => {
        if (myGroup && myGroup.items.length > 0) openStoryViewer(storyGroups.indexOf(myGroup), 0);
        else openCreateStoryModal();
    };
    const myRing = document.createElement('div');
    myRing.className = 'story-ring' + (myGroup ? '' : ' none');
    const myAv = document.createElement('div');
    myAv.className = 'story-avatar';
    if (currentAvatar) {
        const img = document.createElement('img');
        img.src = currentAvatar;
        myAv.appendChild(img);
    } else {
        myAv.textContent = (currentName || '?').charAt(0).toUpperCase();
    }
    myRing.appendChild(myAv);
    if (!myGroup) {
        const plus = document.createElement('div');
        plus.className = 'story-plus';
        plus.textContent = '+';
        myRing.appendChild(plus);
    }
    myCircle.appendChild(myRing);
    const myName = document.createElement('div');
    myName.className = 'story-name';
    myName.textContent = 'Твоя история';
    myCircle.appendChild(myName);
    bar.appendChild(myCircle);

    // Чужие истории
    storyGroups.filter(g => !g.isMe).forEach(g => {
        const c = document.createElement('div');
        c.className = 'story-circle';
        c.onclick = () => openStoryViewer(storyGroups.indexOf(g), 0);
        const ring = document.createElement('div');
        ring.className = 'story-ring';
        const av = document.createElement('div');
        av.className = 'story-avatar';
        if (g.userAvatar) {
            const img = document.createElement('img');
            img.src = g.userAvatar;
            av.appendChild(img);
        } else {
            av.textContent = (g.userName || '?').charAt(0).toUpperCase();
        }
        ring.appendChild(av);
        c.appendChild(ring);
        const nm = document.createElement('div');
        nm.className = 'story-name';
        nm.textContent = g.userName;
        c.appendChild(nm);
        bar.appendChild(c);
    });
}

// ===== ПРОСМОТРЩИК =====
function openStoryViewer(groupIdx, itemIdx) {
    currentStoryGroup = groupIdx;
    currentStoryItem = itemIdx;
    document.getElementById('storyViewer').classList.remove('hidden');
    showStoryItem();
}

function showStoryItem() {
    clearInterval(storyTimer);
    clearInterval(storyProgressTimer);

    const g = storyGroups[currentStoryGroup];
    if (!g) { closeStoryViewer(); return; }
    const item = g.items[currentStoryItem];
    if (!item) { closeStoryViewer(); return; }

    // Шапка
    const av = document.getElementById('storyViewerAvatar');
    av.innerHTML = '';
    if (g.userAvatar) {
        const img = document.createElement('img');
        img.src = g.userAvatar;
        av.appendChild(img);
    } else {
        av.textContent = (g.userName || '?').charAt(0).toUpperCase();
    }
    document.getElementById('storyViewerName').textContent = g.userName;
    document.getElementById('storyViewerDelete').classList.toggle('hidden', !g.isMe);

    // Прогресс-бары
    const prog = document.getElementById('storyViewerProgress');
    prog.innerHTML = '';
    g.items.forEach((it, i) => {
        const bar = document.createElement('div');
        bar.className = 'story-progress-bar';
        const fill = document.createElement('div');
        fill.className = 'story-progress-fill';
        if (i < currentStoryItem) fill.style.width = '100%';
        bar.appendChild(fill);
        prog.appendChild(bar);
    });

    // Контент
    const content = document.getElementById('storyViewerContent');
    content.innerHTML = '';
    content.style.background = item.imageUrl ? '#000' : item.bgColor;
    if (item.imageUrl) {
        const img = document.createElement('img');
        img.className = 'story-full';
        img.src = item.imageUrl;
        content.appendChild(img);
    }
        if (item.text) {
        const t = document.createElement('div');
        t.className = 'story-viewer-text';
        t.textContent = item.text;
        t.style.left = (item.textX ?? 50) + '%';
        t.style.top = (item.textY ?? 50) + '%';
        content.appendChild(t);
    }

    // Анимация текущего прогресса (5 секунд)
    const fill = prog.children[currentStoryItem].querySelector('.story-progress-fill');
    const start = Date.now();
    storyProgressTimer = setInterval(() => {
        fill.style.width = Math.min(100, (Date.now() - start) / 5000 * 100) + '%';
    }, 50);

    storyTimer = setTimeout(() => storyNext(), 5000);
}

function storyNext() {
    const g = storyGroups[currentStoryGroup];
    if (currentStoryItem + 1 < g.items.length) {
        currentStoryItem++;
        showStoryItem();
    } else if (currentStoryGroup + 1 < storyGroups.length) {
        currentStoryGroup++;
        currentStoryItem = 0;
        showStoryItem();
    } else {
        closeStoryViewer();
    }
}

function storyPrev() {
    if (currentStoryItem > 0) {
        currentStoryItem--;
    } else if (currentStoryGroup > 0) {
        currentStoryGroup--;
        currentStoryItem = 0;
    }
    showStoryItem();
}

function closeStoryViewer() {
    clearInterval(storyTimer);
    clearInterval(storyProgressTimer);
    document.getElementById('storyViewer').classList.add('hidden');
}

async function deleteCurrentStory() {
    const g = storyGroups[currentStoryGroup];
    const item = g ? g.items[currentStoryItem] : null;
    if (!item) return;
    if (!confirm('Удалить эту историю?')) return;
    try {
        await api(`/api/stories/${item.id}`, 'DELETE');
        closeStoryViewer();
        await loadStories();
    } catch (e) { alert(e.message); }
}

// ===== СОЗДАНИЕ ИСТОРИИ =====
const STORY_COLORS = ['#5b7cfa', '#e74c3c', '#27ae60', '#f39c12', '#8e44ad', '#16a085', '#d35400', '#2c3e50'];

function openCreateStoryModal() {
    document.getElementById('storyText').value = '';
    removeStoryImage();
    storyBgColor = '#5b7cfa';
    renderStoryColors();
    document.getElementById('createStoryModal').classList.remove('hidden');
    storyTextPos = { x: 50, y: 50 };
    applyStoryTextPos();
    initStoryTextDrag();
    updateStoryPreview();
}

function closeCreateStoryModal() {
    document.getElementById('createStoryModal').classList.add('hidden');
}

function updateStoryPreview() {
    const text = document.getElementById('storyText').value;
    document.getElementById('storyLiveText').textContent = text || 'Твой текст…';
    document.getElementById('storyLivePreview').style.background = storyBgColor;
}
function applyStoryTextPos() {
    const t = document.getElementById('storyLiveText');
    t.style.left = storyTextPos.x + '%';
    t.style.top = storyTextPos.y + '%';
}

function initStoryTextDrag() {
    const preview = document.getElementById('storyLivePreview');
    const textEl = document.getElementById('storyLiveText');
    if (!preview || !textEl || textEl.dataset.dragBound) return;
    textEl.dataset.dragBound = '1';

    const startDrag = (e) => {
        e.preventDefault();
        const move = (ev) => {
            const rect = preview.getBoundingClientRect();
            const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
            const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
            let x = ((cx - rect.left) / rect.width) * 100;
            let y = ((cy - rect.top) / rect.height) * 100;
            storyTextPos = {
                x: Math.max(5, Math.min(95, x)),
                y: Math.max(5, Math.min(95, y))
            };
            applyStoryTextPos();
        };
        const stop = () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', stop);
            document.removeEventListener('touchmove', move);
            document.removeEventListener('touchend', stop);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', stop);
        document.addEventListener('touchmove', move);
        document.addEventListener('touchend', stop);
    };

    textEl.addEventListener('mousedown', startDrag);
    textEl.addEventListener('touchstart', startDrag);
}
function renderStoryColors() {
    const wrap = document.getElementById('storyColors');
    wrap.innerHTML = '';
    STORY_COLORS.forEach(c => {
        const b = document.createElement('button');
        b.className = 'story-color' + (c === storyBgColor ? ' active' : '');
        b.style.background = c;
        b.onclick = () => { storyBgColor = c; renderStoryColors(); updateStoryPreview(); };
        wrap.appendChild(b);
    });
}

function previewStoryImage() {
    const input = document.getElementById('storyImageInput');
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Файл слишком большой (макс 5 МБ)'); input.value = ''; return; }
    storyImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById('storyPreviewImg');
        img.src = e.target.result;
        img.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
    input.value = '';
}

function removeStoryImage() {
    storyImageFile = null;
    const img = document.getElementById('storyPreviewImg');
    img.classList.add('hidden');
    img.src = '';
}

        async function publishStory() {
    const text = document.getElementById('storyText').value.trim();
    if (!text && !storyImageFile) { alert('Добавь текст или фото'); return; }

    try {
        let imageUrl = null;
        if (storyImageFile) {
            const fd = new FormData();
            fd.append('image', storyImageFile);
            const res = await fetch('/api/postimage', { method: 'POST', body: fd, credentials: 'same-origin' });
            if (!res.ok) throw new Error('Не удалось загрузить фото');
            const data = await res.json();
            imageUrl = data.imageUrl;
        }
        await api('/api/stories', 'POST', {
            text: text,
            imageUrl: imageUrl,
            bgColor: storyBgColor,
            textX: storyTextPos.x,
            textY: storyTextPos.y
        });
        closeCreateStoryModal();
        await loadStories();
    } catch (e) { alert(e.message); }
}


// ===== ВИДЕО-КРУЖКИ =====
function stopActiveRecording() {
    if (recordingKind === 'video') stopVideoRecording();
    else stopRecording();
}

function cancelActiveRecording() {
    if (recordingKind === 'video') cancelVideoRecording();
    else cancelRecording();
}

async function toggleVideoRecording() {
    if (videoRecorder && videoRecorder.state === 'recording') {
        stopVideoRecording();
    } else {
        await startVideoRecording();
    }
}

async function startVideoRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('🎥 Камера работает только по HTTPS!\n\nОткрой сайт через https-ссылку (cloudflared) — тогда кружки заработают.');
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        videoChunks = [];
        const mime = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4';
        videoRecorder = new MediaRecorder(stream, { mimeType: mime });
        recordingKind = 'video';
        
        videoRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) videoChunks.push(e.data);
        };
        
        videoRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            const videoBlob = new Blob(videoChunks, { type: mime });
            
            if (videoBlob.size < 5000) {
                finishVideoRecording();
                return;
            }
            
            try {
                const fd = new FormData();
                fd.append('video', videoBlob, mime.includes('mp4') ? 'circle.mp4' : 'circle.webm');
                const res = await fetch('/api/chatvideo', {
                    method: 'POST',
                    body: fd,
                    credentials: 'same-origin'
                });
                if (!res.ok) throw new Error('Не удалось загрузить видео');
                const data = await res.json();
                currentVideoUrl = data.videoUrl;
                finishVideoRecording();
                await sendMessage();
            } catch (e) {
                alert(e.message);
                finishVideoRecording();
            }
        };
        
        videoRecorder.start();
        recordingSeconds = 0;
        
        document.getElementById('inputBarContent').classList.add('hidden');
        document.getElementById('inputBarRecording').classList.remove('hidden');
        
        updateRecordingTime();
        recordingTimer = setInterval(() => {
            recordingSeconds++;
            updateRecordingTime();
            if (recordingSeconds >= 30) stopVideoRecording(); // кружки макс 30 сек
        }, 1000);
    } catch (e) {
        alert('Нет доступа к камере: ' + e.message);
    }
}

function stopVideoRecording() {
    if (videoRecorder && videoRecorder.state === 'recording') {
        videoRecorder.stop();
    }
}

function cancelVideoRecording() {
    if (videoRecorder && videoRecorder.state === 'recording') {
        videoRecorder.stream.getTracks().forEach(t => t.stop());
        videoRecorder = null;
    }
    videoChunks = [];
    finishVideoRecording();
}

function finishVideoRecording() {
    clearInterval(recordingTimer);
    videoRecorder = null;
    videoChunks = [];
    recordingKind = null;
    
    document.getElementById('inputBarContent').classList.remove('hidden');
    document.getElementById('inputBarRecording').classList.add('hidden');
    
    updateVoiceButtonVisibility();
}

// ===== УВЕДОМЛЕНИЯ =====
let audioCtx = null;

// Инициализируем AudioContext при первом клике (обход блокировки браузера)
document.addEventListener('click', function initAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            console.log('✅ AudioContext инициализирован');
        } catch (e) {
            console.error('❌ AudioContext не работает:', e);
        }
    }
}, { once: true });

function playMessageSound() {
    console.log('🔊 playMessageSound вызван');
    
    // Пробуем свой звук
    const files = [
        '/sounds/notification.mp3',
        '/sounds/notification.m4a',
        '/sounds/notification.wav',
        '/sounds/notification.webm'
    ];

    function tryPlay(i) {
        if (i >= files.length) {
            console.log('❌ Свой звук не найден, играю стандартный');
            beepDefault();
            return;
        }
        console.log(`🔍 Пробую ${files[i]}`);
        const a = new Audio(files[i]);
        a.volume = 0.8;
        a.play()
            .then(() => console.log(`✅ Звук играет: ${files[i]}`))
            .catch(() => {
                console.log(`⚠️ ${files[i]} не сработал`);
                tryPlay(i + 1);
            });
    }

    tryPlay(0);
}

function beepDefault() {
    console.log('🔔 beepDefault вызван');
    try {
        if (!audioCtx) {
            console.log('⚠️ AudioContext не инициализирован, создаю...');
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(880, audioCtx.currentTime);
        o.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.15);
        g.gain.setValueAtTime(0.2, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start();
        o.stop(audioCtx.currentTime + 0.2);
        console.log('✅ Стандартный звук сыгран');
    } catch (e) {
        console.error('❌ beepDefault упал:', e);
    }
}

function showBrowserNotification(title, body) {
    console.log(`🔔 Показываю уведомление: ${title} — ${body}`);
    if (!('Notification' in window)) {
        console.log('❌ Notification API не поддерживается');
        return;
    }
    console.log(`📋 Permission: ${Notification.permission}`);
    if (Notification.permission === 'granted') {
        try { 
            new Notification(title, { body: body, icon: '/icon.png' });
            console.log('✅ Уведомление показано');
        } catch (e) {
            console.error('❌ Ошибка показа уведомления:', e);
        }
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}
async function enableNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('Твой браузер не поддерживает пуш-уведомления 😔');
        return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { alert('Без разрешения уведомления не включить 🙈'); return; }
    try {
        const reg = await navigator.serviceWorker.ready;
        const vapid = await (await fetch('/api/push/vapid')).json();
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
            sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid.publicKey) });
        }
        const j = sub.toJSON();
        await api('/api/push/subscribe', 'POST', { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
        alert('Уведомления включены! 🔔 Теперь пуши приходят даже с закрытым приложением!');
    } catch (e) {
        alert('Не удалось включить пуш: ' + e.message);
    }
}

function updateTitleBadge() {
    const total = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
    console.log(`🔢 updateTitleBadge: всего непрочитанных = ${total}`);
    document.title = total > 0 ? `(${total}) Мини-чат` : 'Мини-чат';
}

// ===== ЖЕЛЕЗОБЕТОННАЯ НАВИГАЦИЯ =====
setInterval(() => {
    const bn = document.getElementById('bottomNav');
    if (!bn) return;
    const regOpen = !document.getElementById('registerView').classList.contains('hidden');
    const logOpen = !document.getElementById('loginView').classList.contains('hidden');
    const chatOpen = !document.getElementById('chatView').classList.contains('hidden');
    if (regOpen || logOpen || chatOpen) {
        bn.classList.add('hidden');
    } else {
        bn.classList.remove('hidden');
    }
}, 500);

// ===== ФИНАЛЬНЫЙ ФИКС ФОТО v2 (iPhone) =====
function safeReadFile(file, onDone) {
    // Сразу копируем байты в память — иначе iOS "теряет" файл
    file.arrayBuffer().then((buf) => {
        const copy = new File([buf], file.name || 'photo.jpg', { type: file.type || 'image/jpeg' });
        onDone(copy);
    }).catch(() => onDone(file));
}

function heicToJpeg(file, onDone) {
    const isHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
    if (!isHeic) { onDone(file); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 1600;
        let w = img.width, h = img.height;
        if (w > max || h > max) { const k = Math.min(max / w, max / h); w = Math.round(w * k); h = Math.round(h * k); }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob((b) => {
            URL.revokeObjectURL(url);
            if (b) onDone(new File([b], 'photo.jpg', { type: 'image/jpeg' }));
            else onDone(file);
        }, 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); onDone(file); };
    img.src = url;
}

window.previewChatImage = function () {
    const input = document.getElementById('chatImageInput');
    const file = input.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { alert('Файл слишком большой (макс 8 МБ)'); input.value = ''; return; }
    safeReadFile(file, (copy) => {
        input.value = '';
        heicToJpeg(copy, (f) => {
            chatImageFile = f;
            chatImageUrl = null;
            const r = new FileReader();
            r.onload = (e) => {
                document.getElementById('chatPreviewImg').src = e.target.result;
                document.getElementById('chatImagePreview').classList.remove('hidden');
                if (typeof updateVoiceButtonVisibility === 'function') updateVoiceButtonVisibility();
            };
            r.readAsDataURL(f);
        });
    });
};

window.previewPostImage = function () {
    const input = document.getElementById('postImageInput');
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Файл слишком большой (макс 5 МБ)'); input.value = ''; return; }
    safeReadFile(file, (copy) => {
        input.value = '';
        heicToJpeg(copy, (f) => {
            postImageFile = f;
            const r = new FileReader();
            r.onload = (e) => {
                document.getElementById('previewImg').src = e.target.result;
                document.getElementById('imagePreview').classList.remove('hidden');
                document.getElementById('addPhotoBtn').classList.add('hidden');
            };
            r.readAsDataURL(f);
        });
    });
};

window.previewStoryImage = function () {
    const input = document.getElementById('storyImageInput');
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Файл слишком большой (макс 5 МБ)'); input.value = ''; return; }
    safeReadFile(file, (copy) => {
        input.value = '';
        heicToJpeg(copy, (f) => {
            storyImageFile = f;
            const r = new FileReader();
            r.onload = (e) => {
                const img = document.getElementById('storyPreviewImg');
                img.src = e.target.result;
                img.classList.remove('hidden');
            };
            r.readAsDataURL(f);
        });
    });
};

// ===== iOS KEYBOARD: ФИНАЛ v2 =====
(function () {
    function setHeight() {
        const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        document.documentElement.style.setProperty('--app-height', h + 'px');
    }
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', setHeight);
        window.visualViewport.addEventListener('scroll', () => {
            window.scrollTo(0, 0);
            setHeight();
        });
    }
    window.addEventListener('orientationchange', () => setTimeout(setHeight, 100));
    setHeight();
})();
