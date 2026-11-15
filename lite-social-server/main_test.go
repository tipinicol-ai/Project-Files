package main

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMediaServesByteRangesForVideoFilenameWithSpaces(t *testing.T) {
	oldFilesDir := filesDir
	filesDir = t.TempDir()
	t.Cleanup(func() { filesDir = oldFilesDir })

	name := "preview clip de prueba.mp4"
	content := []byte("0123456789abcdefghijklmnop")
	if err := os.WriteFile(filepath.Join(filesDir, name), content, 0600); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodGet, "/media/"+url.PathEscape(name), nil)
	request.Header.Set("Range", "bytes=4-10")
	response := httptest.NewRecorder()

	media(response, request)

	if response.Code != http.StatusPartialContent {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusPartialContent)
	}
	if got := response.Header().Get("Content-Type"); got != "video/mp4" {
		t.Fatalf("Content-Type = %q, want video/mp4", got)
	}
	if got := response.Header().Get("Accept-Ranges"); got != "bytes" {
		t.Fatalf("Accept-Ranges = %q, want bytes", got)
	}
	if got := response.Body.String(); got != string(content[4:11]) {
		t.Fatalf("range body = %q, want %q", got, content[4:11])
	}
}

func TestHomeRendersVideoAndLogoutInsideProfile(t *testing.T) {
	oldState := state
	state = State{
		Users:    map[string]string{"gamer": hash("password")},
		Posts:    map[string]Post{"video-id": {ID: "video-id", File: "preview clip.mp4", Caption: "Partida", Author: "gamer", Reactions: map[string]int{}}},
		Profiles: map[string]Profile{},
	}
	t.Cleanup(func() { state = oldState })

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.AddCookie(&http.Cookie{Name: "pf_user", Value: "gamer"})
	response := httptest.NewRecorder()
	home(response, request)
	body := response.Body.String()

	for _, want := range []string{
		`src="/assets/community-banner.webp"`,
		`<details class="profile">`,
		`<a class="profile-link logout-link" href="/logout">Cerrar sesión</a>`,
		`<video class="media" controls playsinline preload="metadata"`,
		`src="/media/preview%20clip.mp4"`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("page missing %q", want)
		}
	}
	if strings.Contains(body, `<footer class="feed-footer"><a href="/logout">`) {
		t.Error("logout link should not be outside the profile menu")
	}
}

func TestLogoutExpiresSessionCookie(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/logout", nil)
	response := httptest.NewRecorder()
	logout(response, request)

	if response.Code != http.StatusSeeOther || response.Header().Get("Location") != "/" {
		t.Fatalf("logout response = %d / %q, want redirect to /", response.Code, response.Header().Get("Location"))
	}
	cookie := response.Result().Cookies()[0]
	if cookie.Name != "pf_user" || cookie.MaxAge >= 0 || !cookie.HttpOnly {
		t.Fatalf("session cookie not cleared securely: %#v", cookie)
	}
}

func TestReferenceBannersAreEmbedded(t *testing.T) {
	for _, name := range []string{"assets/login-banner.jpg", "assets/register-banner.webp", "assets/community-banner.webp", "assets/lite-social.css"} {
		if _, err := embeddedAssets.ReadFile(name); err != nil {
			t.Errorf("embedded asset %q: %v", name, err)
		}
	}
}
