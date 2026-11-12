from allauth.account.models import EmailAddress
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import reverse

from .models import Floor, Room


class AdminAccessTests(TestCase):
    def setUp(self):
        self.floor = Floor.objects.get_or_create(number=1, defaults={"name": "1st floor"})[0]
        self.room = Room.objects.create(number="101", floor=1, room_type="Studio", rent=5000)

    def test_visitor_does_not_see_manage_button_or_pages(self):
        home = self.client.get(reverse("home"))
        self.assertNotContains(home, "Manage site")
        r = self.client.get(reverse("manage_home"))
        self.assertEqual(r.status_code, 302)  # sent to the login page

    def test_normal_user_gets_404(self):
        User.objects.create_user("tenant", "tenant@example.com", "pw12345!")
        self.client.login(username="tenant", password="pw12345!")
        self.assertNotContains(self.client.get(reverse("home")), "Manage site")
        self.assertEqual(self.client.get(reverse("manage_home")).status_code, 404)
        self.assertEqual(self.client.post(reverse("manage_room_delete", args=[self.room.pk])).status_code, 404)
        self.assertTrue(Room.objects.filter(pk=self.room.pk).exists())

    @override_settings(ADMIN_EMAILS=["boss@gmail.com"])
    def test_verified_admin_email_can_manage(self):
        u = User.objects.create_user("boss", "boss@gmail.com", "pw12345!")
        EmailAddress.objects.create(user=u, email="boss@gmail.com", verified=True, primary=True)
        self.client.login(username="boss", password="pw12345!")
        self.assertContains(self.client.get(reverse("home")), "Manage site")
        self.assertEqual(self.client.get(reverse("manage_home")).status_code, 200)
        self.assertEqual(self.client.get(reverse("manage_floors")).status_code, 200)
        self.assertEqual(self.client.get(reverse("manage_room_edit", args=[self.room.pk])).status_code, 200)

    @override_settings(ADMIN_EMAILS=["boss@gmail.com"])
    def test_unverified_email_is_not_admin(self):
        User.objects.create_user("fake", "boss@gmail.com", "pw12345!")
        self.client.login(username="fake", password="pw12345!")
        self.assertEqual(self.client.get(reverse("manage_home")).status_code, 404)

    def test_admin_can_edit_room_and_rename_floor(self):
        User.objects.create_superuser("root", "root@example.com", "pw12345!")
        self.client.login(username="root", password="pw12345!")
        r = self.client.post(reverse("manage_room_edit", args=[self.room.pk]), {
            "number": "101", "floor": "1", "room_type": "Deluxe", "rent": "6500", "status": "occupied",
            "video_url": "",
        })
        self.assertEqual(r.status_code, 302)
        self.room.refresh_from_db()
        self.assertEqual((self.room.room_type, int(self.room.rent), self.room.status), ("Deluxe", 6500, "occupied"))
        self.client.post(reverse("manage_floor_rename", args=[self.floor.pk]), {"name": "Ground floor"})
        self.assertEqual(Room.objects.get(pk=self.room.pk).get_floor_display(), "Ground floor")


class ViewingRequestTests(TestCase):
    def setUp(self):
        from datetime import timedelta
        from django.utils import timezone
        Floor.objects.get_or_create(number=1, defaults={"name": "1st floor"})
        self.room = Room.objects.create(number="101", floor=1, room_type="Studio", rent=5000)
        self.url = reverse("book_viewing", args=["101"])
        self.data = {"name": "Maria Santos", "phone": "0917 123 4567",
                     "preferred_date": (timezone.localdate() + timedelta(days=3)).isoformat(),
                     "preferred_slot": "afternoon", "message": "Two of us"}
        self.user = User.objects.create_user("maria", "maria@example.com", "pw12345!")

    def test_must_be_signed_in(self):
        r = self.client.post(self.url, self.data)
        self.assertEqual(r.status_code, 401)
        self.assertIn("login", r.json())

    def test_signed_in_visitor_can_book_once(self):
        from .models import ViewingRequest
        self.client.login(username="maria", password="pw12345!")
        r = self.client.post(self.url, self.data)
        self.assertEqual(r.status_code, 200)
        vr = ViewingRequest.objects.get()
        self.assertEqual((vr.room_number, vr.email, vr.status), ("101", "maria@example.com", "new"))
        again = self.client.post(self.url, self.data)
        self.assertEqual(again.status_code, 409)  # same room twice

    def test_bad_input_and_occupied_room(self):
        self.client.login(username="maria", password="pw12345!")
        bad = dict(self.data, phone="abc", preferred_date="2000-01-01")
        r = self.client.post(self.url, bad)
        self.assertEqual(r.status_code, 422)
        self.assertIn("phone", r.json()["errors"])
        self.assertIn("preferred_date", r.json()["errors"])
        self.room.status = "occupied"
        self.room.save()
        self.assertEqual(self.client.post(self.url, self.data).status_code, 409)

    def test_only_admins_see_requests(self):
        from .models import ViewingRequest
        self.client.login(username="maria", password="pw12345!")
        self.client.post(self.url, self.data)
        self.assertEqual(self.client.get(reverse("manage_requests")).status_code, 404)
        self.assertEqual(self.client.get(reverse("manage_requests_poll")).status_code, 404)
        self.client.logout()
        User.objects.create_superuser("root", "root@example.com", "pw12345!")
        self.client.login(username="root", password="pw12345!")
        page = self.client.get(reverse("manage_requests"))
        self.assertContains(page, "Maria Santos")
        self.assertEqual(self.client.get(reverse("manage_requests_poll")).json()["new"], 1)
        vr = ViewingRequest.objects.get()
        self.client.post(reverse("manage_request_status", args=[vr.pk]), {"status": "contacted"})
        vr.refresh_from_db()
        self.assertEqual(vr.status, "contacted")
