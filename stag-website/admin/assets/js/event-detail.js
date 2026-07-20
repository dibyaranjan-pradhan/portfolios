/**
 * STAG Admin — Event Detail Page
 */
(function () {
  'use strict';

  // ── Auth guard ──────────────────────────────────────────────────────────────
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  // ── Get event ID from URL ────────────────────────────────────────────────────
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('id');

  if (!eventId) {
    document.getElementById('errorMessage').style.display = 'block';
    document.getElementById('eventContent').style.display = 'none';
  }

  // ── Elements ─────────────────────────────────────────────────────────────────
  const backBtn = document.getElementById('backBtn');
  const errorBackBtn = document.getElementById('errorBackBtn');
  const eventContent = document.getElementById('eventContent');
  const errorMessage = document.getElementById('errorMessage');

  const galleryMain = document.getElementById('galleryMain');
  const galleryThumbs = document.getElementById('galleryThumbs');
  
  const infoDate = document.getElementById('infoDate');
  const infoTime = document.getElementById('infoTime');
  const infoVenue = document.getElementById('infoVenue');
  const infoCategory = document.getElementById('infoCategory');
  const infoEntryType = document.getElementById('infoEntryType');
  const infoPrice = document.getElementById('infoPrice');
  const infoCapacity = document.getElementById('infoCapacity');
  const infoDressCode = document.getElementById('infoDressCode');
  const infoAgeRestriction = document.getElementById('infoAgeRestriction');
  const infoContact = document.getElementById('infoContact');
  const infoDescription = document.getElementById('infoDescription');
  const infoAdditional = document.getElementById('infoAdditional');
  
  const priceItem = document.getElementById('priceItem');
  const capacityItem = document.getElementById('capacityItem');
  const descriptionSection = document.getElementById('descriptionSection');
  const additionalSection = document.getElementById('additionalSection');
  const capacityCardSmall = document.getElementById('capacityCardSmall');
  
  const statusBadge = document.getElementById('statusBadge');
  const togglePostBtn = document.getElementById('togglePostBtn');
  const editEventBtn = document.getElementById('editEventBtn');
  const deleteEventBtn = document.getElementById('deleteEventBtn');

  let currentEvent = null;
  let currentPhotoIndex = 0;

  // ── Fetch helpers ───────────────────────────────────────────────────────────
  async function apiAbs(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: {
        ...opts.headers,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = 'index.html';
      return null;
    }

    const data = await res.json();
    return data;
  }

  function formatDate(dateStr) {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '—';
    }
  }

  function formatTime(timeStr) {
    return timeStr ? timeStr.substring(0, 5) : '—';
  }

  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Get image URL from file ID ──────────────────────────────────────────────
  function getImageUrl(fileId) {
    // Assuming images are stored in S3 and accessible via a standard URL pattern
    // This needs to be confirmed with your backend setup
    if (!fileId) {
      console.warn('getImageUrl called with empty fileId');
      return null;
    }
    const url = `${API_BASE}/v1/file/${fileId}`;
    console.log(`getImageUrl: fileId="${fileId}" → "${url}"`);
    return url;
  }

  // ── Load Event Details ──────────────────────────────────────────────────────
  async function loadEvent() {
    try {
      console.log('Loading event:', eventId);
      const response = await apiAbs(API_BASE + '/v1/event/' + eventId);
      console.log('Event response:', response);
      
      // Handle different response formats
      let eventData = null;
      if (response && response.id) {
        eventData = response;
      } else if (response && response.data && response.data.id) {
        eventData = response.data;
      } else if (response && response.data && response.data.event) {
        eventData = response.data.event;
      }

      if (eventData && eventData.id) {
        currentEvent = eventData;
        console.log('Event data loaded:', {
          id: eventData.id,
          name: eventData.name,
          photoIds: eventData.photoIds,
          photoIdsArray: Array.isArray(eventData.photoIds),
          photoIdsLength: eventData.photoIds?.length,
          coverImageId: eventData.coverImageId,
          allEventKeys: Object.keys(eventData)
        });
        // Add diagnostic output
        window.lastEventDebug = {
          eventId: eventData.id,
          name: eventData.name,
          photoIds: eventData.photoIds,
          coverImageId: eventData.coverImageId
        };
        console.table(window.lastEventDebug);
        renderEvent();
      } else {
        console.error('No valid event data found in response:', response);
        showError();
      }
    } catch (error) {
      console.error('Error loading event:', error);
      showError();
    }
  }

  function showError() {
    eventContent.style.display = 'none';
    errorMessage.style.display = 'block';
  }

  // ── Render Event Details ────────────────────────────────────────────────────
  function renderEvent() {
    if (!currentEvent) return;

    console.log('Rendering event:', currentEvent);

    // Setup gallery
    const photos = currentEvent.photoIds && currentEvent.photoIds.length > 0 
      ? currentEvent.photoIds 
      : (currentEvent.coverImageId ? [currentEvent.coverImageId] : []);

    console.log('Photos array for gallery:', photos);
    renderGallery(photos);

    // Basic info
    infoDate.textContent = formatDate(currentEvent.date);
    infoTime.textContent = formatTime(currentEvent.startTime) + ' – ' + formatTime(currentEvent.endTime);
    infoVenue.textContent = esc(currentEvent.venue) || '—';
    infoCategory.textContent = esc(currentEvent.category) || '—';
    infoEntryType.textContent = (currentEvent.entryType || 'free').charAt(0).toUpperCase() + (currentEvent.entryType || 'free').slice(1);

    // Conditional fields
    if (currentEvent.entryType === 'paid' && currentEvent.price) {
      priceItem.style.display = 'flex';
      infoPrice.textContent = '₹' + currentEvent.price.toLocaleString('en-IN');
    }

    if (currentEvent.capacity) {
      capacityItem.style.display = 'flex';
      infoCapacity.textContent = currentEvent.capacity + ' people';
      capacityCardSmall.style.display = 'block';
      document.getElementById('capacityNumberSmall').textContent = currentEvent.capacity;
    }

    infoDressCode.textContent = esc(currentEvent.dressCode) || '—';
    infoAgeRestriction.textContent = currentEvent.ageRestriction ? '18+ Only' : 'All Ages';
    infoContact.textContent = esc(currentEvent.contactNumber) || '—';

    // Descriptions
    if (currentEvent.description) {
      descriptionSection.style.display = 'block';
      infoDescription.textContent = esc(currentEvent.description);
    }

    if (currentEvent.additionalInformation) {
      additionalSection.style.display = 'block';
      infoAdditional.textContent = esc(currentEvent.additionalInformation);
    }

    // Status
    updateStatusDisplay();

    eventContent.style.display = 'block';
    errorMessage.style.display = 'none';
  }

  function renderGallery(photoIds) {
    console.log('renderGallery called with:', photoIds, 'Type:', typeof photoIds, 'Length:', photoIds?.length);
    if (!photoIds || photoIds.length === 0) {
      console.warn('No photoIds provided to renderGallery');
      galleryMain.innerHTML = '<div class="empty" style="text-align: center; padding: 40px; color: var(--muted);">No event photos available</div>';
      galleryThumbs.innerHTML = '';
      return;
    }

    // Main image
    const mainImg = getImageUrl(photoIds[0]);
    console.log('Main image URL:', mainImg);
    if (mainImg) {
      galleryMain.innerHTML = `<img src="${mainImg}" alt="Event photo" onerror="console.error('Image failed:', '${mainImg}')" />`;
    } else {
      console.error('Failed to generate image URL for:', photoIds[0]);
    }

    // Thumbnails
    galleryThumbs.innerHTML = photoIds.map((photoId, idx) => {
      const imgUrl = getImageUrl(photoId);
      console.log(`Photo ${idx} URL:`, imgUrl);
      return `
        <div class="gallery-thumb ${idx === 0 ? 'active' : ''}" onclick="window.switchPhoto(${idx})">
          <img src="${imgUrl}" alt="Photo ${idx + 1}" />
        </div>
      `;
    }).join('');

    currentPhotoIndex = 0;
  }

  // ── Switch photo in gallery ─────────────────────────────────────────────────
  window.switchPhoto = (idx) => {
    console.log('switchPhoto called with idx:', idx);
    if (!currentEvent) {
      console.error('No current event available');
      return;
    }
    const photos = currentEvent.photoIds && currentEvent.photoIds.length > 0 
      ? currentEvent.photoIds 
      : (currentEvent.coverImageId ? [currentEvent.coverImageId] : []);
    
    console.log('Available photos:', photos);
    if (idx >= 0 && idx < photos.length) {
      currentPhotoIndex = idx;
      const mainImg = getImageUrl(photos[idx]);
      console.log('Switching to photo', idx, '- URL:', mainImg);
      if (mainImg) {
        galleryMain.innerHTML = `<img src="${mainImg}" alt="Event photo" />`;
      }

      // Update active thumbnail
      document.querySelectorAll('.gallery-thumb').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === idx);
      });
    }
  };

  function updateStatusDisplay() {
    if (!currentEvent) return;

    const isPosted = currentEvent.status === 'posted';
    statusBadge.textContent = isPosted ? 'Posted' : 'Draft';
    statusBadge.className = isPosted 
      ? 'status-badge-large posted' 
      : 'status-badge-large draft';
    
    togglePostBtn.textContent = isPosted ? '⬇️ Unpost Event' : '🚀 Post Event';
  }

  // ── Event Actions ───────────────────────────────────────────────────────────
  backBtn.addEventListener('click', () => {
    window.location.href = 'dashboard.html#events';
  });

  errorBackBtn.addEventListener('click', () => {
    window.location.href = 'dashboard.html#events';
  });

  editEventBtn.addEventListener('click', () => {
    // This will open the edit modal in dashboard
    window.location.href = 'dashboard.html?editEvent=' + eventId + '#events';
  });

  togglePostBtn.addEventListener('click', async () => {
    if (!currentEvent) return;

    const isPosted = currentEvent.status === 'posted';
    const newStatus = isPosted ? 'draft' : 'posted';

    try {
      const response = await apiAbs(API_BASE + '/v1/event/' + eventId, {
        method: 'PUT',
        body: JSON.stringify({
          ...currentEvent,
          status: newStatus,
        }),
      });

      if (response) {
        currentEvent.status = newStatus;
        updateStatusDisplay();
        toast(isPosted ? 'Event unposted' : 'Event posted');
      } else {
        toast('Failed to update event status');
      }
    } catch (error) {
      console.error('Error toggling event:', error);
      toast('Error updating event');
    }
  });

  deleteEventBtn.addEventListener('click', async () => {
    if (!currentEvent) return;

    const confirmed = confirm(`Delete "${currentEvent.name}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      const response = await apiAbs(API_BASE + '/v1/event/' + eventId, {
        method: 'DELETE',
      });

      if (response) {
        toast('Event deleted successfully');
        setTimeout(() => {
          window.location.href = 'dashboard.html#events';
        }, 500);
      } else {
        toast('Failed to delete event');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      toast('Error deleting event');
    }
  });

  // Toast helper
  function toast(msg) {
    // Use shared toast if available
    if (window.toast) {
      window.toast(msg);
    } else {
      alert(msg);
    }
  }

  // ── Load on init ────────────────────────────────────────────────────────────
  if (eventId) {
    loadEvent();
  }
})();
