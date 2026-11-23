import React, { useEffect, useState } from 'react';
import { ImagePlus, Lock, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { MEDIA_VISIBILITY_LABELS, formatArabicDate } from '../lib/labels';
import { ProtectedImage } from '../components/ProtectedImage';
import { useToast } from '../components/ToastProvider';
import type { MediaItem, MediaVisibility, TrainingGroup, UserProfile } from '../types/xo';

export const MediaPage: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { showToast } = useToast();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [groups, setGroups] = useState<TrainingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [albumFilter, setAlbumFilter] = useState('all');

  const [showUpload, setShowUpload] = useState(false);
  const [titleAr, setTitleAr] = useState('');
  const [albumAr, setAlbumAr] = useState('تدريبات الأكاديمية');
  const [visibility, setVisibility] = useState<MediaVisibility>('academy');
  const [branchId, setBranchId] = useState<'branch_gamal' | 'branch_khalil'>('branch_gamal');
  const [groupId, setGroupId] = useState('');
  const [dataUri, setDataUri] = useState('');
  const [kind, setKind] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);

  const loadMedia = async () => {
    setLoading(true);
    try {
      const [mRes, aRes] = await Promise.all([
        apiFetch<{ media: MediaItem[] }>('/api/media'),
        apiFetch<{ groups: TrainingGroup[] }>('/api/academy'),
      ]);
      setItems(mRes.media);
      setGroups(aRes.groups);
      if (aRes.groups.length > 0 && !groupId) {
        setGroupId(aRes.groups[0].id);
      }
    } catch {
      showToast('تعذر تحميل معرض الوسائط.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, [user.id]);

  const canUpload =
    user.role === 'OWNER' ||
    user.role === 'COACH' ||
    (user.role === 'DELEGATE' &&
      user.delegatePermissions.some((p) => p.permission === 'manage_media'));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      showToast('الحد الأقصى لحجم الملف 4 ميجابايت.', 'error');
      return;
    }
    setKind(file.type.startsWith('video/') ? 'video' : 'image');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDataUri(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataUri) {
      showToast('اختر ملف صورة أو فيديو أولاً.', 'error');
      return;
    }
    setUploading(true);
    try {
      await apiFetch('/api/media', {
        method: 'POST',
        body: JSON.stringify({
          titleAr,
          albumAr,
          kind,
          visibility,
          branchId: visibility === 'branch' || visibility === 'group' ? branchId : null,
          groupId: visibility === 'group' ? groupId : null,
          playerId: null,
          dataUri,
        }),
      });
      showToast('تم رفع الوسائط وحفظ صلاحيات الخصوصية بنجاح.', 'success');
      setShowUpload(false);
      setTitleAr('');
      setDataUri('');
      loadMedia();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر رفع الملف.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const albums = Array.from(new Set(items.map((i) => i.albumAr)));
  const visible = items.filter((i) => albumFilter === 'all' || i.albumAr === albumFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-white">
            XO MEDIA — مكتبة الصور والفيديو
          </h2>
          <p className="text-sm text-[#94A3B8] mt-1">
            وسائط محمية بصلاحيات الفرع والمجموعة واللاعب ولا تُخزن في الكاش العام
          </p>
        </div>

        {canUpload && (
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-sm font-semibold hover:bg-[#e85d10] min-h-[44px] whitespace-nowrap"
          >
            <ImagePlus className="w-4 h-4" />
            <span>رفع صورة أو فيديو</span>
          </button>
        )}
      </div>

      {/* Album segmented filter */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAlbumFilter('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
            albumFilter === 'all'
              ? 'bg-[#FF6B1A] text-white'
              : 'bg-[#101827] border border-white/[0.08] text-[#94A3B8] hover:text-white'
          }`}
        >
          جميع الألبومات
        </button>
        {albums.map((alb) => (
          <button
            key={alb}
            type="button"
            onClick={() => setAlbumFilter(alb)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
              albumFilter === alb
                ? 'bg-[#FF6B1A] text-white'
                : 'bg-[#101827] border border-white/[0.08] text-[#94A3B8] hover:text-white'
            }`}
          >
            {alb}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-64 rounded-2xl bg-[#101827] border border-white/[0.08] animate-pulse" />
      ) : visible.length === 0 ? (
        <div className="rounded-2xl bg-[#101827] border border-white/[0.08] p-10 text-center text-sm text-[#94A3B8]">
          لا توجد وسائط متاحة في هذا الألبوم ضمن صلاحيات حسابك.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl bg-[#101827] border border-white/[0.08] overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/3] bg-[#080D18] overflow-hidden">
                <ProtectedImage
                  src={item.fileUrl}
                  alt={item.titleAr}
                  isPrivateAsset={item.isPrivateAsset}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs text-[#94A3B8]">
                  <span className="flex items-center gap-1 text-[#FF6B1A] font-medium">
                    <Lock className="w-3 h-3" />
                    <span>{MEDIA_VISIBILITY_LABELS[item.visibility]}</span>
                  </span>
                  <span className="font-mono-num">{formatArabicDate(item.createdAt)}</span>
                </div>
                <h3 className="text-sm font-bold text-white">{item.titleAr}</h3>
                <p className="text-xs text-[#94A3B8]">
                  {item.albumAr} · بواسطة {item.uploadedByName}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#101827] border border-white/[0.1] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">رفع وسائط آمنة</h3>
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                className="p-2 text-[#94A3B8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">عنوان الصورة أو الفيديو</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">الألبوم</label>
                  <input
                    type="text"
                    required
                    value={albumAr}
                    onChange={(e) => setAlbumAr(e.target.value)}
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">نطاق الخصوصية</label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as MediaVisibility)}
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                  >
                    {user.role !== 'COACH' && <option value="academy">عام للأكاديمية</option>}
                    {user.role !== 'COACH' && <option value="branch">خاص بالفرع</option>}
                    <option value="group">أعضاء المجموعة فقط</option>
                  </select>
                </div>
              </div>

              {(visibility === 'branch' || visibility === 'group') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#94A3B8] mb-1">الفرع</label>
                    <select
                      value={branchId}
                      onChange={(e) =>
                        setBranchId(e.target.value as 'branch_gamal' | 'branch_khalil')
                      }
                      className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                    >
                      <option value="branch_gamal">ميامي — جمال عبد الناصر</option>
                      <option value="branch_khalil">ميامي — خليل حمادة</option>
                    </select>
                  </div>
                  {visibility === 'group' && (
                    <div>
                      <label className="block text-xs text-[#94A3B8] mb-1">المجموعة</label>
                      <select
                        value={groupId}
                        onChange={(e) => setGroupId(e.target.value)}
                        className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                      >
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.nameAr}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">
                  اختر ملفاً (JPEG / PNG / WEBP / MP4 بحد أقصى 4MB)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                  onChange={handleFileChange}
                  className="w-full text-xs text-[#94A3B8] file:ml-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-[#080D18] file:text-white file:font-semibold"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/[0.1] text-sm text-[#94A3B8]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-sm font-semibold hover:bg-[#e85d10]"
                >
                  {uploading ? 'جاري الرفع...' : 'رفع وحفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
