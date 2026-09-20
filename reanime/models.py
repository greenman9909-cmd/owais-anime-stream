"""Pydantic schemas and response models for ReAnime.to API."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ServerItem(BaseModel):
    serverName: str = Field(..., description="Server name identifier e.g. HD-1 or HD-2")
    dataLink: str = Field(..., description="Full embed URL e.g. https://flixcloud.cc/e/abc?v=2")
    dataType: str = Field(..., description="Stream track type: sub or dub")
    id: Optional[str] = Field(None, alias="$id", description="Unique server link ID")

    model_config = {"populate_by_name": True}


class ServersResponse(BaseModel):
    sub: List[ServerItem] = Field(default_factory=list, description="Subtitled playback servers")
    dub: List[ServerItem] = Field(default_factory=list, description="Dubbed playback servers")
    anilist_id: Optional[int] = Field(None, description="AniList media ID")
    anime: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Anime metadata object")
    intro_start: Optional[int] = Field(None, description="Opening theme start time in seconds")
    intro_end: Optional[int] = Field(None, description="Opening theme end time in seconds")
    outro_start: Optional[int] = Field(None, description="Ending credits start time in seconds")
    outro_end: Optional[int] = Field(None, description="Ending credits end time in seconds")
    current: Optional[Any] = Field(None, description="Current episode information")
    duration: Optional[Any] = Field(None, description="Episode runtime in seconds")


class SubtitleTrack(BaseModel):
    url: str = Field(..., description="Direct URL to the subtitle file")
    language: str = Field(..., description="Subtitle track label e.g. English (Track 2 (ENG))")
    format: Optional[str] = Field("srt", description="Subtitle format: srt or vtt")
    default: Optional[bool] = Field(False, description="Whether this is the default subtitle track")


class ChapterInfo(BaseModel):
    start: float = Field(..., description="Chapter start time in seconds")
    end: float = Field(..., description="Chapter end time in seconds")
    title: Optional[str] = Field(None, description="Chapter title e.g. Intro or Credits")


class StreamResponse(BaseModel):
    url: str = Field(..., description="Resolved playable HLS master.m3u8 stream URL")
    subtitles: List[SubtitleTrack] = Field(default_factory=list, description="List of subtitle tracks")
    thumbnails_vtt: Optional[str] = Field(None, description="URL to WebVTT sprite sheet for seek bar previews")
    video_title: Optional[str] = Field(None, description="Decoded media title")
    intro_chapter: Optional[ChapterInfo] = Field(None, description="Intro chapter marker")
    outro_chapter: Optional[ChapterInfo] = Field(None, description="Outro chapter marker")
    video_id: Optional[str] = Field(None, description="Internal CDN video UUID")


class HealthResponse(BaseModel):
    status: str = Field("ok", description="Service health status")
    version: str = Field("1.0.0", description="API version")
    service: str = Field("ReAnime.to-API", description="Service name")
