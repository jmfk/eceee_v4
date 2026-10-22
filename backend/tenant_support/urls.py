from django.urls import path

from . import views

urlpatterns = [
    path("context/", views.ContextView.as_view()),
    path("inbox/", views.InboxView.as_view()),
    path("inbox/<uuid:pk>/", views.EntryView.as_view()),
    path("instructions/", views.InstructionsView.as_view()),
    path("instructions/<uuid:pk>/", views.InstructionView.as_view()),
    path("threads/", views.ThreadsView.as_view()),
    path("threads/<uuid:pk>/", views.ThreadView.as_view()),
    path("videos/", views.VideoUploadView.as_view()),
    path("videos/<uuid:pk>/playback/", views.VideoPlaybackView.as_view()),
    path("deliveries/", views.DeliveriesView.as_view()),
]
