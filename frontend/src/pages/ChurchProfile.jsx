import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/client.js';
import { useFetch } from '../api/useFetch.js';
import { useSnackbar, Loading, Empty, PageBanner } from '../ui/Shared.jsx';
import { Icon } from '../ui/icons.jsx';

function resizeImage(file, maxSize = 1280, quality = 0.82) {
  // Reads an image file and returns a resized JPEG data-URL to keep uploads small.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      // Guard against files the browser cannot decode (e.g. HEIC on some devices):
      // give up after 10s so the upload list does not hang.
      const timer = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        reject(new Error('decode-timeout'));
      }, 10000);
      img.onload = () => {
        clearTimeout(timer);
        if (!img.naturalWidth) {
          reject(new Error('decode-failed'));
          return;
        }
        // Shrink only when the image is larger than maxSize, keeping its aspect ratio.
        let { width, height } = img;
        const scale = Math.min(1, maxSize / Math.max(width, height));
        if (scale < 1) {
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => {
        clearTimeout(timer);
        reject(new Error('decode-failed'));
      };
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ChurchProfile() {
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const isAdmin = user?.role === 'admin';

  const { data, loading, reload } = useFetch(() => api.get('/api/church-content').catch(() => null), []);
  const [section, setSection] = useState('name');
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [basics, setBasics] = useState([]);
  const [organisations, setOrganisations] = useState([]);
  const [activities, setActivities] = useState([]);
  const [social, setSocial] = useState({ phone: '', whatsapp: '', email: '', facebook: '', tiktok: '' });
  const [logo, setLogo] = useState('');
  const [gallery, setGallery] = useState([]);
  const [news, setNews] = useState([]);
  const [imgCaption, setImgCaption] = useState('');
  const [orgCaption, setOrgCaption] = useState('');
  const [galleryCaption, setGalleryCaption] = useState('');
  const [newsTitle, setNewsTitle] = useState('');
  const [newsContent, setNewsContent] = useState('');

  React.useEffect(() => {
    if (data) {
      setName(data.church_name || '');
      setTagline(data.tagline || '');
      setBasics(data.basics || []);
      setOrganisations(data.organisations || []);
      setActivities(data.activities || []);
      setGallery(data.gallery || []);
      setNews(data.news || []);
      setSocial({ phone: '', whatsapp: '', email: '', facebook: '', tiktok: '', ...(data.social || {}) });
      setLogo(data.logo || '');
    }
  }, [data]);

  async function save() {
    setBusy(true);
    try {
      if (section === 'name') await api.put('/api/church-content/name', { value: name });
      else if (section === 'tagline') await api.put('/api/church-content/tagline', { value: tagline });
      else if (section === 'basics') await api.put('/api/church-content/basics', { items: basics });
      else if (section === 'organisations') await api.put('/api/church-content/organisations', { items: organisations });
      else if (section === 'activities') await api.put('/api/church-content/activities', { items: activities });
      else if (section === 'gallery') await api.put('/api/church-content/gallery', { items: gallery });
      else if (section === 'news') await api.put('/api/church-content/news', { items: news });
      else if (section === 'social') await api.put('/api/church-content/social', { value: social });
      else if (section === 'logo') await api.put('/api/church-content/logo', { value: logo });
      snackbar('Saved', 'success');
      reload().catch(() => {});
    } catch (err) {
      snackbar(err.message || 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  // Adds one or more selected images to the given About/Mission item ("basics").
  // All files share a single caption (the one typed before picking), and each
  // image can still be re-captioned individually afterwards.
  async function addImages(i, files, caption) {
    const list = Array.from(files || []);
    if (!list.length) return;
    if (list.some((f) => !f.type.startsWith('image/'))) {
      snackbar('Please choose image files only', 'error');
      return;
    }
    try {
      const added = [];
      for (const file of list) {
        try {
          added.push({ image: await resizeImage(file), caption: String(caption || '').trim() });
        } catch {
          // Skip unreadable files but keep processing the rest.
          snackbar(`Could not read "${file.name || 'image'}"`, 'error');
        }
      }
      setBasics(basics.map((x, j) => (j === i ? { ...x, images: [...(x.images || []), ...added] } : x)));
    } catch {
      snackbar('Could not read one or more images', 'error');
    }
  }

  function updateImageCaption(i, idx, caption) {
    setBasics(
      basics.map((x, j) =>
        j === i
          ? {
              ...x,
              images: (x.images || []).map((img, k) => {
                const cur = typeof img === 'string' ? { image: img, caption: '' } : img;
                return k === idx ? { ...cur, caption } : cur;
              }),
            }
          : x
      )
    );
  }

  function removeImage(i, idx) {
    setBasics(basics.map((x, j) => (j === i ? { ...x, images: (x.images || []).filter((_, k) => k !== idx) } : x)));
  }

  // Same multi-upload flow as addImages, but for a public Organisation entry
  // (its pictures are stored in the "pictures" field).
  async function addOrgImages(i, files, caption) {
    const list = Array.from(files || []);
    if (!list.length) return;
    if (list.some((f) => !f.type.startsWith('image/'))) {
      snackbar('Please choose image files only', 'error');
      return;
    }
    try {
      const added = [];
      for (const file of list) {
        try {
          added.push({ image: await resizeImage(file), caption: String(caption || '').trim() });
        } catch {
          snackbar(`Could not read "${file.name || 'image'}"`, 'error');
        }
      }
      setOrganisations(organisations.map((x, j) => (j === i ? { ...x, pictures: [...(x.pictures || []), ...added] } : x)));
    } catch {
      snackbar('Could not read one or more images', 'error');
    }
  }

  function updateOrgImageCaption(i, idx, caption) {
    setOrganisations(
      organisations.map((x, j) =>
        j === i
          ? {
              ...x,
              pictures: (x.pictures || []).map((pic, k) => {
                const cur = typeof pic === 'string' ? { image: pic, caption: '' } : pic;
                return k === idx ? { ...cur, caption } : cur;
              }),
            }
          : x
      )
    );
  }

  function removeOrgImage(i, idx) {
    setOrganisations(organisations.map((x, j) => (j === i ? { ...x, pictures: (x.pictures || []).filter((_, k) => k !== idx) } : x)));
  }

  async function addGalleryImages(files, caption) {
    const list = Array.from(files || []);
    if (!list.length) return;
    if (list.some((f) => !f.type.startsWith('image/'))) {
      snackbar('Please choose image files only', 'error');
      return;
    }
    try {
      const added = [];
      for (const file of list) {
        try {
          added.push({ image: await resizeImage(file), caption: String(caption || '').trim() });
        } catch {
          snackbar(`Could not read "${file.name || 'image'}"`, 'error');
        }
      }
      setGallery((prev) => [...prev, ...added]);
    } catch {
      snackbar('Could not read one or more images', 'error');
    }
  }

  async function pickLogo(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      snackbar('Please choose an image file', 'error');
      return;
    }
    try {
      const dataUrl = await resizeImage(file);
      setLogo(dataUrl);
    } catch {
      snackbar('Could not read image', 'error');
    }
  }

  if (!isAdmin) {
    return (
      <div>
        <PageBanner title="Church Profile" />
        <div className="card">Only admins can edit the church profile.</div>
      </div>
    );
  }

  if (loading) return <Loading />;

  const tabs = [
    ['name', 'Church Name'],
    ['tagline', 'Tagline'],
    ['logo', 'Logo'],
    ['basics', 'About / Mission'],
    ['organisations', 'Organisations'],
    ['activities', 'Activities'],
    ['gallery', 'Gallery'],
    ['news', 'Church News'],
    ['social', 'Social Media'],
  ];

  return (
    <div>
      <PageBanner
        title="Church Profile"
        subtitle="Edit public church information"
        actions={
          <button className="btn primary" onClick={save} disabled={busy}>
            {busy ? 'Saving\u2026' : 'Save Changes'}
          </button>
        }
      />

      <div className="tabs">
        {tabs.map(([key, label]) => (
          <button key={key} className={section === key ? 'active' : ''} onClick={() => setSection(key)}>
            {label}
          </button>
        ))}
      </div>

      {section === 'name' && (
        <div className="card">
          <div className="field">
            <label>Church name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
      )}

      {section === 'tagline' && (
        <div className="card">
          <div className="field">
            <label>Tagline</label>
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>
        </div>
      )}

      {section === 'logo' && (
        <div className="card">
          <p className="muted mb-16" style={{ fontSize: 13 }}>
            This logo will appear on the nav bar of the app.
          </p>
          <div className="logo-upload-row">
            <div className="logo-preview">
              {logo ? <img src={logo} alt="Logo preview" /> : <Icon name="cross" size={28} strokeWidth={3} />}
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              <label className="btn secondary file-btn" style={{ display: 'inline-flex', gap: 6 }}>
                <Icon name="upload-cloud" size={15} /> {logo ? 'Change logo' : 'Upload logo'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              {logo && (
                <button className="btn small danger" onClick={() => setLogo('')}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {section === 'basics' && (
        <div>
          {basics.length === 0 && <Empty label="No items." />}
          {basics.map((b, i) => (
            <div className="card mb-16" key={i}>
              <div className="field">
                <label>Title</label>
                <input value={b.title} onChange={(e) => setBasics(basics.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              </div>
              <div className="field">
                <label>Content</label>
                <textarea value={b.content} onChange={(e) => setBasics(basics.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))} />
              </div>
              <div className="field">
                <label>Images</label>
                <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                  These will appear on the details page of this section.
                </p>
                {(b.images || []).length > 0 && (
                  <div className="upload-gallery">
                    {(b.images || []).map((img, k) => {
                      const cur = typeof img === 'string' ? { image: img, caption: '' } : img;
                      return (
                        <div className="upload-thumb" key={k}>
                          <img src={cur.image} alt="" />
                          <div className="field" style={{ width: '100%' }}>
                            <input
                              placeholder="Image name / tag"
                              value={cur.caption || ''}
                              onChange={(e) => updateImageCaption(i, k, e.target.value)}
                            />
                          </div>
                          <button type="button" className="btn small danger" onClick={() => removeImage(i, k)} title="Remove">
                            <Icon name="trash-2" size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <label className="btn secondary file-btn" style={{ display: 'inline-flex', gap: 6, marginTop: 8 }}>
                  <Icon name="upload-cloud" size={15} /> Upload image
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { addImages(i, e.target.files, imgCaption); setImgCaption(''); e.target.value = ''; }} />
                </label>
                <div className="field" style={{ marginTop: 8 }}>
                  <input
                    placeholder="Image name / tag for new images"
                    value={imgCaption}
                    onChange={(e) => setImgCaption(e.target.value)}
                  />
                </div>
              </div>
              <button className="btn small danger" onClick={() => setBasics(basics.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          ))}
          <button className="btn secondary" onClick={() => setBasics([...basics, { title: '', content: '' }])}>
            <Icon name="plus" size={15} /> Add Item
          </button>
        </div>
      )}

      {section === 'organisations' && (
        <div>
          {organisations.length === 0 && <Empty label="No items." />}
          {organisations.map((o, i) => (
            <div className="card mb-16" key={i}>
              <div className="form-row">
                <div className="field">
                  <label>Title</label>
                  <input value={o.title} onChange={(e) => setOrganisations(organisations.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                </div>
                <div className="field">
                  <label>Subtitle</label>
                  <input value={o.subtitle || ''} onChange={(e) => setOrganisations(organisations.map((x, j) => (j === i ? { ...x, subtitle: e.target.value } : x)))} />
                </div>
              </div>
              <div className="field">
                <label>Description</label>
                <textarea value={o.description || ''} onChange={(e) => setOrganisations(organisations.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              </div>
              <div className="field">
                <label>Pictures</label>
                <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                  These will appear on the details page of this organisation.
                </p>
                {(o.pictures || []).length > 0 && (
                  <div className="upload-gallery">
                    {(o.pictures || []).map((pic, k) => {
                      const cur = typeof pic === 'string' ? { image: pic, caption: '' } : pic;
                      return (
                        <div className="upload-thumb" key={k}>
                          <img src={cur.image} alt="" />
                          <div className="field" style={{ width: '100%' }}>
                            <input
                              placeholder="Image name / tag"
                              value={cur.caption || ''}
                              onChange={(e) => updateOrgImageCaption(i, k, e.target.value)}
                            />
                          </div>
                          <button type="button" className="btn small danger" onClick={() => removeOrgImage(i, k)} title="Remove">
                            <Icon name="trash-2" size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <label className="btn secondary file-btn" style={{ display: 'inline-flex', gap: 6, marginTop: 8 }}>
                  <Icon name="upload-cloud" size={15} /> Upload image
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { addOrgImages(i, e.target.files, orgCaption); setOrgCaption(''); e.target.value = ''; }} />
                </label>
                <div className="field" style={{ marginTop: 8 }}>
                  <input
                    placeholder="Image name / tag for new images"
                    value={orgCaption}
                    onChange={(e) => setOrgCaption(e.target.value)}
                  />
                </div>
              </div>
              <button className="btn small danger" onClick={() => setOrganisations(organisations.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          ))}
          <button className="btn secondary" onClick={() => setOrganisations([...organisations, { title: '', subtitle: '', description: '' }])}>
            <Icon name="plus" size={15} /> Add Organisation
          </button>
        </div>
      )}

      {section === 'activities' && (
        <div>
          {activities.length === 0 && <Empty label="No items." />}
          {activities.map((a, i) => (
            <div className="card mb-16" key={i}>
              <div className="form-row">
                <div className="field">
                  <label>Title</label>
                  <input value={a.title} onChange={(e) => setActivities(activities.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                </div>
                <div className="field">
                  <label>Subtitle</label>
                  <input value={a.subtitle || ''} onChange={(e) => setActivities(activities.map((x, j) => (j === i ? { ...x, subtitle: e.target.value } : x)))} />
                </div>
              </div>
              <div className="field">
                <label>Description</label>
                <textarea value={a.description || ''} onChange={(e) => setActivities(activities.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              </div>
              <button className="btn small danger" onClick={() => setActivities(activities.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          ))}
          <button className="btn secondary" onClick={() => setActivities([...activities, { title: '', subtitle: '', description: '' }])}>
            <Icon name="plus" size={15} /> Add Activity
          </button>
        </div>
      )}

      {section === 'gallery' && (
        <div>
          <p className="muted mb-16" style={{ fontSize: 13 }}>
            These images will appear on the public Gallery page. Upload multiple images at once; each gets the same caption
            which you can edit individually afterwards.
          </p>
          {gallery.length > 0 && (
            <div className="upload-gallery">
              {gallery.map((pic, k) => {
                const cur = typeof pic === 'string' ? { image: pic, caption: '' } : pic;
                return (
                  <div className="upload-thumb" key={k}>
                    <img src={cur.image} alt="" />
                    <div className="field" style={{ width: '100%' }}>
                      <input
                        placeholder="Image caption"
                        value={cur.caption || ''}
                        onChange={(e) => setGallery(gallery.map((p, j) => (j === k ? { ...p, caption: e.target.value } : p)))}
                      />
                    </div>
                    <button type="button" className="btn small danger" onClick={() => setGallery(gallery.filter((_, j) => j !== k))} title="Remove">
                      <Icon name="trash-2" size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <label className="btn secondary file-btn" style={{ display: 'inline-flex', gap: 6, marginTop: 8 }}>
            <Icon name="upload-cloud" size={15} /> Upload images
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { addGalleryImages(e.target.files, galleryCaption); setGalleryCaption(''); e.target.value = ''; }} />
          </label>
          <div className="field" style={{ marginTop: 8 }}>
            <input
              placeholder="Caption for new images"
              value={galleryCaption}
              onChange={(e) => setGalleryCaption(e.target.value)}
            />
          </div>
        </div>
      )}

      {section === 'news' && (
        <div>
          <p className="muted mb-16" style={{ fontSize: 13 }}>
            These news items will appear in a scrolling ticker under the hero section on the About the Church page.
            Keep them short and timely.
          </p>
          {news.length > 0 && (
            <div>
              {news.map((n, i) => (
                <div className="card mb-16" key={i}>
                  <div className="field">
                    <label>Title / Headline</label>
                    <input
                      value={n.title || ''}
                      placeholder="e.g. Sunday Service Time Change"
                      onChange={(e) => setNews(news.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    />
                  </div>
                  <div className="field">
                    <label>Content</label>
                    <textarea
                      value={n.content || ''}
                      placeholder="Brief description..."
                      rows={2}
                      onChange={(e) => setNews(news.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))}
                    />
                  </div>
                  <button className="btn small danger" onClick={() => setNews(news.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="card mb-16">
            <h3 style={{ marginBottom: 12, fontSize: 14 }}>Add New Item</h3>
            <div className="field">
              <label>Title / Headline</label>
              <input
                value={newsTitle}
                placeholder="e.g. Sunday Service Time Change"
                onChange={(e) => setNewsTitle(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Content</label>
              <textarea
                value={newsContent}
                placeholder="Brief description..."
                rows={2}
                onChange={(e) => setNewsContent(e.target.value)}
              />
            </div>
            <button className="btn secondary" onClick={() => {
              if (newsTitle.trim() || newsContent.trim()) {
                setNews([...news, { title: newsTitle.trim(), content: newsContent.trim() }]);
                setNewsTitle('');
                setNewsContent('');
              }
            }}>
              <Icon name="plus" size={15} /> Add News Item
            </button>
          </div>
        </div>
      )}

      {section === 'social' && (
        <div className="card">
          <p className="muted mb-16" style={{ fontSize: 13 }}>
            These appear as icons on the "Come Worship With Us" section of the About the Church page.
          </p>
          <div className="field">
            <label>Phone</label>
            <input value={social.phone} placeholder="e.g. +233 24 000 0000" onChange={(e) => setSocial({ ...social, phone: e.target.value })} />
          </div>
          <div className="field">
            <label>WhatsApp</label>
            <input value={social.whatsapp} placeholder="e.g. +233 24 000 0000" onChange={(e) => setSocial({ ...social, whatsapp: e.target.value })} />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={social.email} placeholder="e.g. info@mtolivet.example" onChange={(e) => setSocial({ ...social, email: e.target.value })} />
          </div>
          <div className="field">
            <label>Facebook</label>
            <input value={social.facebook} placeholder="e.g. facebook.com/mtolivetchurch" onChange={(e) => setSocial({ ...social, facebook: e.target.value })} />
          </div>
          <div className="field">
            <label>TikTok</label>
            <input value={social.tiktok} placeholder="e.g. tiktok.com/@mtolivetchurch" onChange={(e) => setSocial({ ...social, tiktok: e.target.value })} />
          </div>
        </div>
      )}
    </div>
  );
}
