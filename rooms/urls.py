from django.urls import path
from . import manage_views as m, views

urlpatterns = [
    path("", views.home, name="home"),
    path("rooms/<str:number>/", views.room_detail, name="room_detail"),
    path("rooms/<str:number>/book/", views.book_viewing, name="book_viewing"),
    path("portal/", views.portal, name="portal"),
    path("portal/receipt/<int:pk>/", views.receipt, name="receipt"),

    # Website administrator pages (only visible to admins)
    path("manage/", m.dashboard, name="manage_home"),
    path("manage/rooms/new/", m.room_edit, name="manage_room_new"),
    path("manage/rooms/<int:pk>/", m.room_edit, name="manage_room_edit"),
    path("manage/rooms/<int:pk>/status/", m.room_status, name="manage_room_status"),
    path("manage/rooms/<int:pk>/delete/", m.room_delete, name="manage_room_delete"),
    path("manage/rooms/<int:pk>/spaces/add/", m.space_add, name="manage_space_add"),
    path("manage/spaces/<int:pk>/", m.space_save, name="manage_space_save"),
    path("manage/spaces/<int:pk>/delete/", m.space_delete, name="manage_space_delete"),
    path("manage/photos/<int:pk>/cover/", m.photo_cover, name="manage_photo_cover"),
    path("manage/photos/<int:pk>/replace/", m.photo_replace, name="manage_photo_replace"),
    path("manage/photos/<int:pk>/delete/", m.photo_delete, name="manage_photo_delete"),
    path("manage/requests/", m.requests_list, name="manage_requests"),
    path("manage/requests/poll/", m.requests_poll, name="manage_requests_poll"),
    path("manage/requests/<int:pk>/status/", m.request_status, name="manage_request_status"),
    path("manage/requests/<int:pk>/delete/", m.request_delete, name="manage_request_delete"),
    path("manage/banner/", m.banner, name="manage_banner"),
    path("manage/banner/remove/", m.banner_remove, name="manage_banner_remove"),
    path("manage/images/", m.page_images, name="manage_images"),
    path("manage/images/remove/", m.page_image_remove, name="manage_image_remove"),
    path("manage/contact/", m.contact_save, name="manage_contact"),
    path("manage/floors/", m.floors, name="manage_floors"),
    path("manage/floors/add/", m.floor_add, name="manage_floor_add"),
    path("manage/floors/<int:pk>/", m.floor_rename, name="manage_floor_rename"),
    path("manage/floors/<int:pk>/delete/", m.floor_delete, name="manage_floor_delete"),
]
