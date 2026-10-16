'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useStepRouter } from '@/lib/navigation/use-step-router';
import { Button } from '@/components/ui/Button';
import { PDFTrigger } from '@/components/pdf/PDFTrigger';
import { JobHistoryTrigger } from '@/components/pdf/JobHistoryTrigger';
import { BRAND_STORAGE_KEYS, getStorageItemWithLegacyFallback } from '@/lib/storage/branding';

const PROFILE_PHOTO_MAX_LONG_EDGE = 1400;
const PROFILE_PHOTO_TARGET_MAX_BYTES = 900 * 1024;
const PROFILE_PHOTO_ABSOLUTE_MAX_BYTES = 4.5 * 1024 * 1024;

function loadImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('IMAGE_DECODE_FAILED'));
    };
    image.src = objectUrl;
  });
}

async function drawToCanvas(file: File) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('CANVAS_CONTEXT_UNAVAILABLE');

  let sourceWidth = 0;
  let sourceHeight = 0;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    sourceWidth = bitmap.width;
    sourceHeight = bitmap.height;

    const longEdge = Math.max(sourceWidth, sourceHeight);
    const scale = longEdge > PROFILE_PHOTO_MAX_LONG_EDGE ? PROFILE_PHOTO_MAX_LONG_EDGE / longEdge : 1;
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas;
  } catch {
    const image = await loadImageElement(file);
    sourceWidth = image.naturalWidth || image.width;
    sourceHeight = image.naturalHeight || image.height;
    const longEdge = Math.max(sourceWidth, sourceHeight);
    const scale = longEdge > PROFILE_PHOTO_MAX_LONG_EDGE ? PROFILE_PHOTO_MAX_LONG_EDGE / longEdge : 1;
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
}

function canvasToJpegFile(canvas: HTMLCanvasElement, fileName: string, quality: number) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('IMAGE_COMPRESS_FAILED'));
          return;
        }
        const baseName = fileName.replace(/\.[^.]+$/, '') || 'profile-photo';
        resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      quality,
    );
  });
}

async function compressProfilePhoto(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('INVALID_IMAGE_TYPE');
  }

  const canvas = await drawToCanvas(file);
  const qualitySteps = [0.88, 0.8, 0.72, 0.64, 0.56, 0.48, 0.4];

  let best = await canvasToJpegFile(canvas, file.name, qualitySteps[0]);
  for (const quality of qualitySteps) {
    const compressed = await canvasToJpegFile(canvas, file.name, quality);
    best = compressed;
    if (compressed.size <= PROFILE_PHOTO_TARGET_MAX_BYTES) {
      break;
    }
  }

  if (best.size > PROFILE_PHOTO_ABSOLUTE_MAX_BYTES) {
    throw new Error('IMAGE_STILL_TOO_LARGE');
  }

  return best;
}

export default function CVStep3() {
  const router = useStepRouter();
  const [summary, setSummary] = useState('');
  const [transferableSkills, setTransferableSkills] = useState('');
  const [savedSummary, setSavedSummary] = useState('');
  const [savedTransferableSkills, setSavedTransferableSkills] = useState('');
  const [isSummarySavedForPdf, setIsSummarySavedForPdf] = useState(false);
  const [fullData, setFullData] = useState<any>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingExperienceAI, setLoadingExperienceAI] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<
    { type: 'success' | 'error'; text: string } | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const resumeId = getStorageItemWithLegacyFallback(BRAND_STORAGE_KEYS.resumeId.current, BRAND_STORAGE_KEYS.resumeId.legacy);
    if (!resumeId) return;

    fetch('/api/data/resume?id=' + resumeId)
      .then(res => res.json())
      .then(data => {
        setFullData(data);
        const initialSummary = data.resume?.summary || '';
        const initialTransferableSkills = data.resume?.transferable_skills || data.resume?.experience_knowledge || '';
        setSummary(initialSummary);
        setSavedSummary(initialSummary);
        setTransferableSkills(initialTransferableSkills);
        setSavedTransferableSkills(initialTransferableSkills);
        if (data.resume && typeof data.resume.profilePhotoUrl === 'string') {
          setProfilePhotoUrl(data.resume.profilePhotoUrl || null);
        }
      });
  }, []);

  const hasUnsavedChanges =
    summary !== savedSummary || transferableSkills !== savedTransferableSkills;
  const requiresSaveBeforePdf = !isSummarySavedForPdf || hasUnsavedChanges;

  const handleProfilePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      setUploadMessage({ type: 'error', text: '画像ファイルが選択されていません' });
      return;
    }

    const resumeId = fullData?.resume?.id || getStorageItemWithLegacyFallback(BRAND_STORAGE_KEYS.resumeId.current, BRAND_STORAGE_KEYS.resumeId.legacy);
    if (!resumeId) {
      setUploadMessage({ type: 'error', text: '履歴書IDが見つかりませんでした' });
      return;
    }

    setUploadingPhoto(true);
    setUploadMessage(null);

    try {
      const uploadFile = await compressProfilePhoto(selectedFile);
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('resumeId', resumeId);

      const res = await fetch('/api/data/resume/profile-photo', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (res.ok && json.ok) {
        const newUrl = json.profilePhotoUrl || null;
        setProfilePhotoUrl(newUrl);
        setFullData((prev: any) =>
          prev
            ? { ...prev, resume: { ...prev.resume, profilePhotoUrl: newUrl } }
            : prev,
        );
        setUploadMessage({ type: 'success', text: 'プロフィール画像を更新しました' });
        router.refresh();
      } else {
        if (json?.error === 'FILE_TOO_LARGE') {
          throw new Error('IMAGE_STILL_TOO_LARGE');
        }
        throw new Error(json.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Profile photo upload failed:', error);
      if (error instanceof Error && error.message === 'IMAGE_STILL_TOO_LARGE') {
        setUploadMessage({
          type: 'error',
          text: '画像サイズが大きすぎます。別の写真を選ぶか、トリミングして再度お試しください。',
        });
      } else if (error instanceof Error && error.message === 'INVALID_IMAGE_TYPE') {
        setUploadMessage({
          type: 'error',
          text: '画像ファイル（JPEG / PNG など）を選択してください。',
        });
      } else {
        setUploadMessage({
          type: 'error',
          text: 'プロフィール画像のアップロードに失敗しました。しばらくしてから再度お試しください。',
        });
      }
    } finally {
      setUploadingPhoto(false);
      event.target.value = '';
    }
  };

  const buildCareerText = () => {
    if (!fullData || !fullData.works || fullData.works.length === 0) return '';

    return fullData.works.map((w: any, index: number) => {
      const year = w.start_year || w.Year || '';
      const month = w.start_month || w.Month || '';
      const company = w.company_name || w.Name || w.Company || w.Title || '会社名不明';
      const desc = w.description || w.Description || w.Notes || '';

      return `【${index + 1}社目】${year}年${month}月入社 ${company} ${desc}`;
    }).join('\n');
  };

  const generateSummary = async () => {
    if (!fullData || !fullData.works || fullData.works.length === 0) {
      alert("職歴データが0件です。Step 4に戻ってデータを追加してください。");
      return;
    }
    setLoadingAI(true);

    try {
      const careerText = buildCareerText();

      if (careerText.replace(/\s/g, '').length < 10) {
        alert("職歴データのテキスト化に失敗しました。データの中身が空のようです。");
        setLoadingAI(false);
        return;
      }

      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ career_text: careerText })
      });
      
      const json = await res.json();
      if (json.result) {
        setSummary(json.result);
      } else {
        alert('AI生成エラー: ' + (json.error || '不明なエラー'));
      }
    } catch (error) {
      alert('通信エラーが発生しました');
    } finally {
      setLoadingAI(false);
    }
  };

  const generateExperienceKnowledge = async () => {
    if (!fullData || !fullData.works || fullData.works.length === 0) {
      alert("職歴データが0件です。Step 4に戻ってデータを追加してください。");
      return;
    }

    const careerText = buildCareerText();
    if (careerText.replace(/\s/g, '').length < 10) {
      alert("職務内容が空のため生成できません。職歴を確認してください。");
      return;
    }

    setLoadingExperienceAI(true);
    try {
      const res = await fetch('/api/ai/experience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experience_text: careerText }),
      });

      const json = await res.json();
      if (json.result) {
        setTransferableSkills(json.result);
      } else {
        alert('AI生成エラー: ' + (json.error || '不明なエラー'));
      }
    } catch (error) {
      alert('通信エラーが発生しました');
    } finally {
      setLoadingExperienceAI(false);
    }
  };

  const onSaveSummary = async () => {
    try {
      const resumeId = getStorageItemWithLegacyFallback(BRAND_STORAGE_KEYS.resumeId.current, BRAND_STORAGE_KEYS.resumeId.legacy);
      if (!resumeId) return;

      const payload = {
        resume_id: resumeId,
        summary,
        transferable_skills: transferableSkills,
      };

      const res = await fetch('/api/data/resume', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('保存失敗');

      setFullData((prev: any) =>
        prev ? { ...prev, resume: { ...prev.resume, summary, transferable_skills: transferableSkills } } : prev
      );
      setSavedSummary(summary);
      setSavedTransferableSkills(transferableSkills);
      setIsSummarySavedForPdf(true);
      alert('保存しました！下のボタンからPDFをダウンロードできます。');

    } catch (error) {
      alert('保存失敗');
    }
  };

  const worksCount = fullData?.works?.length || 0;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">職務要約</h2>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-xs text-gray-500">
              {profilePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profilePhotoUrl}
                  alt="プロフィール写真"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-center leading-tight">No Image</span>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-gray-800">プロフィール写真</p>
              <p className="text-xs text-gray-500">
                スマホで撮影した写真をそのままアップロードできます。
              </p>
            </div>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-2 sm:items-end">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleProfilePhotoUpload}
              disabled={uploadingPhoto}
            />
            <Button
              type="button"
              size="sm"
              className="w-full sm:w-auto"
              isLoading={uploadingPhoto}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingPhoto ? 'アップロード中...' : '画像をアップロード'}
            </Button>
            {uploadMessage ? (
              <p
                className={`text-xs ${
                  uploadMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {uploadMessage.text}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      
      <div className="bg-green-50 p-4 rounded mb-6">
        <h3 className="font-bold text-sm mb-2 text-green-800">職務要約の自動生成</h3>
        <div className="text-xs text-green-700 mb-3">
           <p>登録されている職歴データ数: <strong>{worksCount}件</strong></p>
        </div>
        <Button onClick={generateSummary} isLoading={loadingAI} size="sm" className="bg-green-600 hover:bg-green-700">
          🤖 AIで職務要約を書く
        </Button>
      </div>

      <div className="mb-8 space-y-6">
        <label className="block text-sm font-bold text-gray-700 mb-2">職務要約 (編集可能)</label>
        <textarea
          className="w-full p-3 border rounded-md h-32"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <div className="bg-blue-50 p-4 rounded">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-blue-800 mb-1">活かせる経験・知識</p>
              <p className="text-xs text-blue-700 mb-2">入力した職歴情報を元にAIが自動で生成します。</p>
            </div>
            <Button onClick={generateExperienceKnowledge} isLoading={loadingExperienceAI} size="sm" className="bg-blue-600 hover:bg-blue-700">
              💡 AIで生成する
            </Button>
          </div>
          <textarea
            className="w-full p-3 border rounded-md h-32 mt-3"
            value={transferableSkills}
            onChange={(e) => setTransferableSkills(e.target.value)}
            placeholder={`- プロジェクトリード経験により...
- 新規開拓営業の知見を活用し...`}
          />
        </div>
        <div className="text-right mt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onSaveSummary}
            disabled={!summary && !transferableSkills}
            className={
              requiresSaveBeforePdf
                ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-md ring-2 ring-amber-300 animate-pulse hover:bg-amber-100'
                : undefined
            }
          >
            要約・活かせる経験を保存してPDFに反映
          </Button>
          {requiresSaveBeforePdf ? (
            <p className="mt-2 text-xs text-amber-700">
              ※ PDF出力の前に、要約・活かせる経験の保存が必要です。
            </p>
          ) : null}
        </div>
      </div>

      <hr className="my-8" />

      <div className="text-center p-8 border-2 border-dashed rounded-lg bg-gray-50">
        <h3 className="text-lg font-bold mb-6">🎉 応募書類の準備ができました</h3>
        {fullData ? (
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-2">JIS規格フォーマット</p>
              <PDFTrigger data={fullData} disabled={requiresSaveBeforePdf} />
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-2">標準ビジネスフォーマット</p>
              <JobHistoryTrigger data={fullData} disabled={requiresSaveBeforePdf} />
            </div>
          </div>
        ) : (
          <p>データを読み込み中...</p>
        )}
      </div>

      <div className="mt-8 text-center">
        <Button variant="ghost" onClick={() => router.push('/')}>トップへ戻る</Button>
      </div>
    </div>
  );
}
